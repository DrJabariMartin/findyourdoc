// Run on a schedule (e.g. every 15 minutes): npm run reminders
import { PrismaClient } from "@prisma/client";
import { sendDueReminders } from "../src/lib/reminders";

const db = new PrismaClient();
sendDueReminders(db)
  .then((n) => console.log(`Sent ${n} reminder(s).`))
  .finally(() => db.$disconnect());
