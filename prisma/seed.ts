import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SUPERADMIN_EMAIL = (
  process.env.SEED_SUPERADMIN_EMAIL ?? "owner@sushi-online.test"
).toLowerCase();
const SUPERADMIN_PASSWORD = process.env.SEED_SUPERADMIN_PASSWORD ?? "change-me";

async function upsertSuperAdmin() {
  const existing = await prisma.user.findUnique({ where: { email: SUPERADMIN_EMAIL } });
  if (existing) return existing;
  const passwordHash = await bcrypt.hash(SUPERADMIN_PASSWORD, 12);
  const user = await prisma.user.create({
    data: {
      email: SUPERADMIN_EMAIL,
      name: "Owner",
      passwordHash,
      isSuperAdmin: true,
    },
  });
  console.log(`Created superadmin ${user.email} (password: ${SUPERADMIN_PASSWORD})`);
  return user;
}

async function upsertDemoRestaurant(ownerId: string) {
  const existing = await prisma.restaurant.findUnique({ where: { slug: "taro" } });
  if (existing) {
    // Ensure membership exists even if rerun.
    await prisma.restaurantMember.upsert({
      where: { userId_restaurantId: { userId: ownerId, restaurantId: existing.id } },
      create: { userId: ownerId, restaurantId: existing.id, role: "admin" },
      update: {},
    });
    console.log(`Restaurant "taro" already exists (${existing.id})`);
    return existing;
  }

  const restaurant = await prisma.restaurant.create({
    data: {
      name: "Taro Sushi",
      slug: "taro",
      primaryColor: "#b91c1c",
      secondaryColor: "#fef2f2",
      currency: "CAD",
      address: "501 North Rd, Coquitlam, BC V3J 1N7",
      phone: "(604) 555-0199",
      businessHours: [
        { day: 0, open: "12:00", close: "21:00" },
        { day: 1, open: "11:30", close: "22:00" },
        { day: 2, open: "11:30", close: "22:00" },
        { day: 3, open: "11:30", close: "22:00" },
        { day: 4, open: "11:30", close: "22:00" },
        { day: 5, open: "11:30", close: "23:00" },
        { day: 6, open: "12:00", close: "23:00" },
      ],
      members: { create: { userId: ownerId, role: "admin" } },
      menus: {
        create: {
          name: "Main",
          categories: {
            create: [
              {
                name: "Nigiri",
                order: 1,
                items: {
                  create: [
                    { name: "Salmon Nigiri", description: "Two pieces", price: 650, sortOrder: 1 },
                    { name: "Tuna Nigiri", description: "Two pieces", price: 750, sortOrder: 2 },
                    { name: "Hamachi Nigiri", description: "Two pieces", price: 850, sortOrder: 3 },
                  ],
                },
              },
              {
                name: "Rolls",
                order: 2,
                items: {
                  create: [
                    { name: "Dragon Roll", description: "Eel, avocado", price: 1650, sortOrder: 1 },
                    { name: "Spicy Tuna Roll", price: 1350, sortOrder: 2 },
                    { name: "California Roll", price: 1050, sortOrder: 3 },
                  ],
                },
              },
              {
                name: "Drinks",
                order: 3,
                items: {
                  create: [
                    { name: "Green Tea", price: 300, sortOrder: 1 },
                    { name: "Ramune", description: "Japanese soda", price: 450, sortOrder: 2 },
                  ],
                },
              },
            ],
          },
        },
      },
    },
  });

  console.log(`Seeded "${restaurant.name}" (id=${restaurant.id})`);
  console.log(`Visit http://taro.localhost:3000/menu`);
  return restaurant;
}

async function main() {
  const admin = await upsertSuperAdmin();
  await upsertDemoRestaurant(admin.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
