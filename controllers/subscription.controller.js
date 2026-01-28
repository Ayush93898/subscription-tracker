import { SERVER_URl } from "../config/env.js";
import { workflowClient } from "../config/upstash.js";
import Subscription from "../models/subscription.model.js";

// controllers of subscription

export const createSubscription = async (req, res, next) => {
  try {
    const subscription = await Subscription.create({
      ...req.body, // extract everything that user passsing
      user: req.user._id, // i.e jo loggedIn hai whi subscription create kar sakta hai
    });

    const { workflowRunId } = await workflowClient.trigger({
      url: `${SERVER_URl}/api/v1/workflows/subscription/reminder`,
      body: {
        subscriptionId: subscription.id,
      },
      headers: {
        "content-type": "application/json",
      },
      retries: 0,
    });

    res.status(201).json({
      success: true,
      data: subscription,
      workflowRunId
    });
  } catch (error) {
    next(error);
  }
};

// another controller that give all the subscription created by user..
export const getUserSubscriptions = async (req, res, next) => {
  try {
    if (!req.user._id.equals(req.params.id)) {
      // as user._id -> is object but req.params.id -> String
      const error = new Error("You are not the owner of this account");
      error.status = 401;
      throw error;
    }
    const subscription = await Subscription.find({ user: req.params.id });
    res.status(200).json({ success: true, data: subscription });
  } catch (error) {
    next(error);
  }
};

// get all user -- work is same as upper one contoller
// NOTE--> Remove /user/:id route and use that one
export const getAllSubscriptions = async (req, res, next) => {
  try {
    // finding all subscription belonging to the logged in user
    const subscriptios = await Subscription.find({ user: req.user._id }).sort({
      createdAt: -1,
    }); // newest first

    res.status(200).json({
      success: true,
      count: subscriptios.length,
      data: subscriptios,
    });
  } catch (error) {
    next(error);
  }
};

// GET single subscription detail
export const getSubscriptionDetail = async (req, res, next) => {
  try {
    const subscription = await Subscription.findById(req.params.id);

    //check if subscription exist
    if (!subscription) {
      const error = new Error("Subscription not found");
      error.status = 404;
      throw error;
    }

    // check if user own this subscription
    if (subscription.user.toString() !== req.user._id.toString()) {
      const error = new Error(
        "You are not authorized to view this subscription",
      );
      error.status = 403;
      throw error;
    }
    res.status(200).json({
      success: true,
      data: subscription,
    });
  } catch (error) {
    next(error);
  }
};

// UPDATE subscription
export const updateSubscription = async (req, res, next) => {
  try {
    const subscription = await Subscription.findById(req.params.id);
    if (!subscription) {
      const error = new Error("Subscription not found");
      error.status = 404;
      throw error;
    }

    if (subscription.user.toString() !== req.user._id.toString()) {
      const error = new Error(
        "You are not authorized to update this subscription",
      );
      error.status = 403;
      throw error;
    }

    // update fields from request body
    const allowedUpdates = [
      "name",
      "price",
      "currency",
      "frequency",
      "category",
      "paymentMethod",
      "startDate",
      "renewalDate",
    ];
    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        subscription[field] = req.body[field];
      }
    });
    await subscription.save(); // this triggers the pre save hook
    // ye kafi nice move hai...as we can also use model.findByIdAndUpdate() but isse pre('save') trigger nahi hoga
    // and renewal khud se calculate nhi hoga
    // so that foreach + .save() ensure that renewalDate is recalculated if startDate or frequency change

    res.status(200).json({
      success: true,
      message: "Subscription updated successfully",
      data: subscription,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE subscription
export const deleteSubscription = async (req, res, next) => {
  try {
    const subsciption = await Subscription.findById(req.params.id);

    //check if subscription exist
    if (!subsciption) {
      const error = new Error("Subscription not found");
      error.status = 404;
      throw error;
    }

    //check ownership
    if (subsciption.user.toString() !== req.user._id.toString()) {
      const error = new Error(
        "You are not authorized to delete this subscription",
      );
      error.status = 403;
      throw error;
    }

    await Subscription.findByIdAndDelete(req.params.id);
    res.status(200).json({
      success: true,
      message: "Subscription deleted successfuly!",
    });
  } catch (error) {
    next(error);
  }
};

// CANCEL subscription (only sets status to cancelled)
export const cancelSubscription = async (req, res, next) => {
  try {
    const subsciption = await Subscription.findById(req.params.id);

    // check if subscription exists
    if (!subsciption) {
      const error = new Error("subscription not found");
      error.status = 404;
      throw error;
    }

    //check ownership
    if (subsciption.user.toString() !== req.user._id.toString()) {
      const error = new Error(
        "You are not authorizes to cancel this subscription",
      );
      error.status = 403;
      throw error;
    }

    // check if already cancel
    if (subsciption.status === "cancelled") {
      const error = new Error("Subscription is already cancelled");
      error.status = 400;
      throw error;
    }
    subsciption.status = "cancelled";
    await subsciption.save();
    res.status(200).json({
      success: true,
      message: "Subscription cancelled successfully",
      data: subsciption,
    });
  } catch (error) {
    next(error);
  }
};

// ## Intuition Behind Each Controller

// ### 1. **getAllSubscriptions**
// - **What**: Get all subscriptions for the logged-in user
// - **Why**: Dashboard view showing all their subscriptions
// - **Security**: Uses `req.user._id` from auth middleware, so users only see their own

// ### 2. **getSubscriptionDetail**
// - **What**: Get details of one specific subscription
// - **Why**: Click on a subscription to see full details
// - **Security**: Check if subscription exists AND if user owns it (double check)

// ### 3. **updateSubscription**
// - **What**: Modify subscription details (price changed, payment method updated, etc.)
// - **Why**: User needs to update when subscription terms change
// - **Security**: Only owner can update, restricted fields prevent changing `user` or `status` directly
// - **Smart**: Uses `allowedUpdates` array to prevent malicious field updates

// ### 4. **deleteSubscription**
// - **What**: Permanently remove subscription from database
// - **Why**: User no longer uses this service
// - **Security**: Only owner can delete

// ### 5. **cancelSubscription**
// - **What**: Mark subscription as cancelled (soft delete - keeps data)
// - **Why**: User wants to cancel but keep history for records
// - **Different from delete**: Delete removes completely, cancel keeps for analytics/history

// ### 6. **getUpcomingRenewals**
// - **What**: Find subscriptions renewing in next 7 days
// - **Why**: Reminder feature so users know what's charging soon
// - **Smart**: Uses MongoDB date range query (`$gte`, `$lte`)
