// creating a fn which will be responsible for sending the reminder

// setup and imports
import { sendReminderEmail } from "../utils/send-email.js";
import dayjs from "dayjs"; // A library for working with dates (lighter alternative to moment.js) , Makes date calculations easy

import Subscription from "../models/subscription.model.js";

// neeche ke do lines--- allow to use common js in module env
import { createRequire } from "module";
const require = createRequire(import.meta.url);
// importing serve fn
const { serve } = require("@upstash/workflow/express"); // but this is common js
// Analogy: You're translating between two languages (ES modules ↔ CommonJS).

// creating a list of diff remindersm
const REMINDERS = [7, 5, 2, 1];

//main workflow fn
export const sendReminders = serve(async (context) => {
  const { subscriptionId } = context.requestPayload;

  // Use the fixed spelling 'subscription'
  const subscription = await fetchSubscription(context, subscriptionId);

  if (!subscription || subscription.status !== "active") return;

  const renewalDate = dayjs(subscription.renewalDate);

  for (const daysBefore of REMINDERS) {
    const reminderDate = renewalDate.subtract(daysBefore, "day");

    // If the reminder date is in the future, wait for it
    if (reminderDate.isAfter(dayjs())) {
      await sleepUntilReminder(
        context,
        `Reminder ${daysBefore} days before`,
        reminderDate,
      );
    }

    // RE-FETCH or RE-CHECK status after a long sleep
    // The subscription might have been cancelled while the workflow was sleeping!
    const updatedSub = await fetchSubscription(context, subscriptionId);
    if (!updatedSub || updatedSub.status !== "active") break;

    // Trigger if we are now at or past the reminder date
    // This ensures that even if we 'missed' the exact second, the email still goes out
    if (dayjs().isSame(reminderDate, 'day') || dayjs().isAfter(reminderDate)) {
       await triggerReminder(context, `${daysBefore} days before reminder`, updatedSub);
    }
  }
});

// server()-> a wrapper thats makes your fn work as Qstash workflow
//context - sp object that contains - requestPayload(data u sent when triggering the wrokflow), run() mtd - special mtd to run task reliably
// context.requestPayload = The data you passed in

const fetchSubscription = async (context, subscriptionId) => {
  return await context.run("get subscription", async() => {
    return await Subscription.findById(subscriptionId).populate("user", "name email"); 
  });
};

// context.run(....) -- special way to run database queries in workflow
// 'get subscription' --  A label/name for this step (for debugging/logs)
// Mongoose's way of joining data from related collections 

const sleepUntilReminder = async (context, label, date) => {
  console.log(`Sleeping until ${label} reminder at ${date}`);
  await context.sleepUntil(label, date.toDate()); // toDate()-- Converts dayjs object to JavaScript Date object
};

const triggerReminder = async (context, label, subscription) => {
  return await context.run(label, async () => {
    console.log(`Triggering ${label} reminder`);

    await sendReminderEmail({
      to: subscription.user.email,
      type: label,
      subscription,
    })
  })
}