// before setting the arcjet middleware , first we have to configre an active instance of arcjet
import aj from "../config/arcjet.js";

const arcjetMiddleware = async (req, res, next) => {
  try {
    if (!req.headers["user-agent"]) {
      return next(); // skip Arcjet
    }

      const decision = await aj.protect(
      {
        ...req,
        ip: req.ip || req.headers["x-forwarded-for"] || "127.0.0.1",
      },
      { requested: 1 }
    );

    if (decision.isDenied()) {
      if (decision.reason.isRateLimit())
        return res.status(429).json({ error: "Rate limit exceeded" });
      if (decision.reason.isBot())
        return res.status(403).json({ error: "BOT detected" });
      return res.status(403).json({ error: "Access denied" });
    }

    next();
  } catch (error) {
    console.log(`Arcjet Middleware Error: ${error}`);
    next(error);
  }
};

export default arcjetMiddleware;