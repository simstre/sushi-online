import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { stripe } from "@/lib/stripe/client";
import { getTenantFromHeaders } from "@/lib/tenant/resolve";
import { getCurrentUser } from "@/lib/auth/require";
import { getOrCreateStripeCustomer } from "@/lib/stripe/customer";

const selectedChoiceSchema = z.object({
  choiceId: z.string().min(1),
  // name & price are hints from the client; we replace them with the server
  // snapshot before persisting so the client can't forge a discount.
  name: z.string().optional(),
  price: z.number().optional(),
});

const selectedGroupSchema = z.object({
  groupId: z.string().min(1),
  groupName: z.string().optional(),
  choices: z.array(selectedChoiceSchema),
});

const bodySchema = z.object({
  customerName: z.string().min(1).max(120),
  customerPhone: z.string().min(3).max(40),
  customerEmail: z.string().email().optional(),
  items: z
    .array(
      z.object({
        menuItemId: z.string().min(1),
        quantity: z.number().int().positive(),
        modifiers: z.array(selectedGroupSchema).default([]),
      }),
    )
    .min(1),
});

type StoredChoice = { id: string; name: string; price: number };
type StoredGroup = {
  id: string;
  name: string;
  required: boolean;
  maxSelect: number;
  choices: StoredChoice[];
};

function parseStoredModifiers(raw: unknown): StoredGroup[] {
  if (!Array.isArray(raw)) return [];
  const out: StoredGroup[] = [];
  for (const g of raw) {
    if (!g || typeof g !== "object") continue;
    const gr = g as Record<string, unknown>;
    const choicesRaw = Array.isArray(gr.choices) ? gr.choices : [];
    const choices: StoredChoice[] = [];
    for (const c of choicesRaw) {
      if (!c || typeof c !== "object") continue;
      const cr = c as Record<string, unknown>;
      const id = typeof cr.id === "string" ? cr.id : "";
      const name = typeof cr.name === "string" ? cr.name : "";
      const price = typeof cr.price === "number" ? cr.price : 0;
      if (id && name) choices.push({ id, name, price });
    }
    const id = typeof gr.id === "string" ? gr.id : "";
    const name = typeof gr.name === "string" ? gr.name : "";
    if (!id || !name || choices.length === 0) continue;
    out.push({
      id,
      name,
      required: gr.required === true,
      maxSelect: typeof gr.maxSelect === "number" ? gr.maxSelect : 0,
      choices,
    });
  }
  return out;
}

export async function POST(req: Request) {
  const tenant = await getTenantFromHeaders();
  if (!tenant) {
    return NextResponse.json({ error: "Unknown tenant" }, { status: 404 });
  }

  const user = await getCurrentUser();

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { customerName, customerPhone, customerEmail, items } = parsed.data;

  // Price items + validate modifiers server-side — never trust client prices.
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: items.map((i) => i.menuItemId) }, isAvailable: true },
    include: { category: { include: { menu: true } } },
  });

  type PricedItem = {
    menuItemId: string;
    quantity: number;
    price: number; // unit price in cents (base + chosen deltas)
    modifiers: Prisma.InputJsonValue | typeof Prisma.JsonNull;
  };

  const priced: PricedItem[] = [];
  for (const i of items) {
    const m = menuItems.find((mi) => mi.id === i.menuItemId);
    if (!m) {
      return NextResponse.json(
        { error: `Menu item ${i.menuItemId} not found` },
        { status: 400 },
      );
    }
    if (m.category.menu.restaurantId !== tenant.id) {
      return NextResponse.json(
        { error: `Menu item ${i.menuItemId} does not belong to this restaurant` },
        { status: 400 },
      );
    }

    const stored = parseStoredModifiers(m.modifiers);
    const storedById = new Map(stored.map((g) => [g.id, g]));

    // Validate each submitted group against the stored groups for this item.
    let delta = 0;
    const snapshot: StoredGroup[] = [];
    for (const submitted of i.modifiers) {
      const g = storedById.get(submitted.groupId);
      if (!g) {
        return NextResponse.json(
          { error: `Unknown modifier group for ${m.name}` },
          { status: 400 },
        );
      }
      if (g.maxSelect > 0 && submitted.choices.length > g.maxSelect) {
        return NextResponse.json(
          { error: `Too many selections for "${g.name}"` },
          { status: 400 },
        );
      }
      const picked: StoredChoice[] = [];
      const seen = new Set<string>();
      for (const c of submitted.choices) {
        if (seen.has(c.choiceId)) continue;
        seen.add(c.choiceId);
        const real = g.choices.find((rc) => rc.id === c.choiceId);
        if (!real) {
          return NextResponse.json(
            { error: `Unknown choice for "${g.name}"` },
            { status: 400 },
          );
        }
        picked.push(real);
        delta += real.price;
      }
      if (picked.length > 0) {
        snapshot.push({
          id: g.id,
          name: g.name,
          required: g.required,
          maxSelect: g.maxSelect,
          choices: picked,
        });
      }
    }

    // Required groups must have ≥1 choice.
    for (const g of stored) {
      if (!g.required) continue;
      const s = snapshot.find((x) => x.id === g.id);
      if (!s || s.choices.length === 0) {
        return NextResponse.json(
          { error: `Please choose "${g.name}" for ${m.name}` },
          { status: 400 },
        );
      }
    }

    const unitPrice = m.price + delta;
    priced.push({
      menuItemId: m.id,
      quantity: i.quantity,
      price: unitPrice,
      modifiers:
        snapshot.length > 0
          ? ({
              groups: snapshot.map((g) => ({
                groupId: g.id,
                groupName: g.name,
                choices: g.choices.map((c) => ({
                  id: c.id,
                  name: c.name,
                  price: c.price,
                })),
              })),
            } as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
    });
  }

  const total = priced.reduce((sum, p) => sum + p.price * p.quantity, 0);
  if (total <= 0) {
    return NextResponse.json({ error: "Cart total must be positive" }, { status: 400 });
  }
  if (tenant.minOrder && total < tenant.minOrder) {
    return NextResponse.json(
      {
        error: `Minimum order is ${(tenant.minOrder / 100).toFixed(2)}; you have ${(total / 100).toFixed(2)}.`,
      },
      { status: 400 },
    );
  }

  const order = await prisma.order.create({
    data: {
      restaurantId: tenant.id,
      userId: user?.id ?? null,
      status: "pending",
      totalAmount: total,
      customerName,
      customerPhone,
      customerEmail: customerEmail ?? user?.email ?? null,
      items: { create: priced },
    },
  });

  const intentParams: Parameters<typeof stripe.paymentIntents.create>[0] = {
    amount: total,
    currency: tenant.currency.toLowerCase(),
    automatic_payment_methods: { enabled: true },
    metadata: {
      orderId: order.id,
      restaurantId: tenant.id,
      userId: user?.id ?? "",
    },
  };

  // For direct-charge (non-Connect) tenants, attach the platform Stripe customer
  // so saved cards appear in PaymentElement and future charges stay on record.
  // Saved cards aren't reused across Connect accounts — skipping when stripeAccountId is set.
  if (user && !tenant.stripeAccountId) {
    intentParams.customer = await getOrCreateStripeCustomer(user.id);
    intentParams.setup_future_usage = "off_session";
  }

  // Stripe Connect: if the tenant has a connected account, route funds there.
  const requestOptions: Parameters<typeof stripe.paymentIntents.create>[1] = tenant.stripeAccountId
    ? { stripeAccount: tenant.stripeAccountId }
    : undefined;

  const intent = await stripe.paymentIntents.create(intentParams, requestOptions);

  await prisma.payment.create({
    data: {
      orderId: order.id,
      stripePaymentIntentId: intent.id,
      status: intent.status,
    },
  });

  return NextResponse.json({ clientSecret: intent.client_secret, orderId: order.id });
}
