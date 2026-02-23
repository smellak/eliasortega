import { prisma } from "./db/client";

const DEFAULT_SLOTS = [
  { dayOfWeek: 1, startTime: "08:00", endTime: "10:00", maxPoints: 6 },
  { dayOfWeek: 1, startTime: "10:00", endTime: "12:00", maxPoints: 6 },
  { dayOfWeek: 1, startTime: "12:00", endTime: "14:00", maxPoints: 6 },
  { dayOfWeek: 2, startTime: "08:00", endTime: "10:00", maxPoints: 6 },
  { dayOfWeek: 2, startTime: "10:00", endTime: "12:00", maxPoints: 6 },
  { dayOfWeek: 2, startTime: "12:00", endTime: "14:00", maxPoints: 6 },
  { dayOfWeek: 3, startTime: "08:00", endTime: "10:00", maxPoints: 6 },
  { dayOfWeek: 3, startTime: "10:00", endTime: "12:00", maxPoints: 6 },
  { dayOfWeek: 3, startTime: "12:00", endTime: "14:00", maxPoints: 6 },
  { dayOfWeek: 4, startTime: "08:00", endTime: "10:00", maxPoints: 6 },
  { dayOfWeek: 4, startTime: "10:00", endTime: "12:00", maxPoints: 6 },
  { dayOfWeek: 4, startTime: "12:00", endTime: "14:00", maxPoints: 6 },
  { dayOfWeek: 5, startTime: "08:00", endTime: "10:00", maxPoints: 6 },
  { dayOfWeek: 5, startTime: "10:00", endTime: "12:00", maxPoints: 6 },
  { dayOfWeek: 5, startTime: "12:00", endTime: "14:00", maxPoints: 6 },
  { dayOfWeek: 6, startTime: "08:00", endTime: "11:00", maxPoints: 4 },
  { dayOfWeek: 6, startTime: "11:00", endTime: "14:00", maxPoints: 4 },
];

async function seedSlots() {
  const existing = await prisma.slotTemplate.count();
  if (existing > 0) {
    console.log(`Already have ${existing} slot templates, skipping seed.`);
    return;
  }

  for (const slot of DEFAULT_SLOTS) {
    await prisma.slotTemplate.create({
      data: {
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        maxPoints: slot.maxPoints,
        active: true,
      },
    });
  }

  console.log(`Seeded ${DEFAULT_SLOTS.length} slot templates.`);
}

seedSlots()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  });
