import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Subscription name is required"],
      trim: true,
      minLength: 2,
      maxLength: 155,
    },
    price: {
      type: Number,
      required: [true, "Subscription price is required"],
      min: [0, "Price must be greater than 0"],
    },
    currency: {
      type: String,
      enum: ["USD", "EUR", "RUPEE"],
      default: "USD",
    },
    frequency: {
      type: String,
      enum: ["daily", "weekly", "monthly", "yearly"],
    },
    category: {
      type: String,
      enum: [
        "sports",
        "news",
        "entertainment",
        "lifestyle",
        "technnology",
        "finance",
        "politics",
        "other",
      ],
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "expired", "cancelled"],
      default: "active",
    },
    startDate: {
      type: Date,
      required: true,
      validate: {
        validator: (value) => value <= new Date(),
        message: "Start date must be in the past",
      },
    },
    renewalDate: {
      type: Date,
      // required : true,
      validate: {
        validator: function (value) {
          return value > this.startDate;
        },
        message: "Renewal date must be after the start date",
      },
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

// auto calculating renewal date if missing
// pre hook is code that runs AUTOMATICALLY before something happens.
//Before saving a subscription to the database, run this code first.
subscriptionSchema.pre("save", function (next) {
  if (!this.renewalDate) { // if user did't provide the renewal date 
    const renewalPeriods = {
      daily: 1,
      weekly: 7,
      monthly: 30,
      yearly: 365,
    };
    this.renewalDate = new Date(this.startDate);
    this.renewalDate.setDate(
      this.renewalDate.getDate() + renewalPeriods[this.frequency]
    );
  }
  // auto update the status , if renewal date has passed
  if (this.renewalDate < new Date()) this.status = "expired";
  next(); // next() → tells Mongoose “I’m done, continue saving”
});

const Subscription = mongoose.model("Subscription", subscriptionSchema);
export default Subscription;

// eg
//  "startDate": "2025-01-01",
// "frequency": "monthly" .. this.frequency = "monthly" , renewalPeriods["monthly"] = 30, getDate() = 1
// 1 + 30 = 31 .... setDate(31).... i.e renewalDate = 2025-01-31