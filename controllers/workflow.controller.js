// creating a fn which will be responsible for sending the reminder

// setup and imports
import dayjs from "dayjs";
import Subscription from "../models/subscription.model.js";

// neeche ke do lines--- allow to use common js in module env
import { createRequire } from "module";
const require = createRequire(import.meta.url);
// importing serve fn
const { serve } = require("@upstash/workflow/express"); // but this is common js


// creating a list of diff remindersm
const REMINDERS = [7,5,2,1];


//main workflow fn
export const sendReminders = serve(async (context) => {
  const { subscriptionId } = context.requestPayload;
  const subsciption = await fetchSubscription(context, subscriptionId);
  if (!subsciption || subsciption.status !== "active") return; // get out of the fun

  const renewalDate = dayjs(Subscription.renewalDate);
  if (renewalDate.isBefore(dayjs())) {
    // checking renDta is before curr date
    console.log(
      `Renwal date has passed for subscription ${subscriptionId}. Stopping workflow.`,
    );
    return;
  }
  for(const daysBefore of REMINDERS){
    const reminderDate = renewalDate.subtract(daysBefore,'day')
    // ren date = 22 feb rem date = 15 feb (7 days before), 17, 20, 21


  }
});
// server()-> a wrapper thats makes your fn work as Qstash workflow
//context - sp object that contains - requestPayload(data u sent when triggering the wrokflow), run() mtd - special mtd to run task reliably
// context.requestPayload = The data you passed in

const fetchSubscription = async (context, subscriptionId) => {
  return await context.run("get subscription", () => {
    return Subscription.findById(subscriptionId).populate("user", "name email"); // join data from user collection
  });
};

// context.run(....) -- special way to run database queries in workflow
// 'get subscription' --  A label/name for this step (for debugging/logs)
//

const sleepUntilReminder = async(context, label, date)=>{
    console.log(`Sleeping until ${label} reminder at ${date}`)
    await context.sleepUntil(label,date.toDate())
}

