/**
 * Stripe billing for one-time Remove Ads.
 * Webhook is the only path that sets profile.adsRemoved = true.
 */

const REMOVE_ADS_PRODUCT = "remove_ads";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  try {
    // Lazy require so local server boots without stripe installed in odd envs.
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    const Stripe = require("stripe");
    // Prefer a widely supported API version; Stripe SDK pins at runtime.
    return new Stripe(key);
  } catch (err) {
    console.warn("[billing] stripe package missing:", err?.message || err);
    return null;
  }
}

function getPriceId() {
  return (
    process.env.STRIPE_REMOVE_ADS_PRICE_ID?.trim() ||
    process.env.STRIPE_PRICE_REMOVE_ADS?.trim() ||
    ""
  );
}

function getWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET?.trim() || "";
}

function siteOriginFromReq(req) {
  const configured =
    process.env.PUBLIC_WEB_ORIGIN?.trim() ||
    process.env.EXPO_PUBLIC_WEB_ORIGIN?.trim() ||
    "https://shifuguru.github.io";
  const basePath =
    process.env.PUBLIC_WEB_BASE_PATH?.trim() ||
    process.env.EXPO_PUBLIC_BASE_PATH?.trim() ||
    "/ps_and_as";
  return { origin: configured.replace(/\/$/, ""), basePath: basePath || "" };
}

function absoluteReturnUrl(req, pathFromClient) {
  const { origin, basePath } = siteOriginFromReq(req);
  const raw =
    typeof pathFromClient === "string" && pathFromClient.startsWith("/")
      ? pathFromClient
      : "/?purchase=remove_ads_success";
  // path is app-relative (e.g. /?purchase=...); prefix GitHub Pages base.
  const joined = `${basePath}${raw}`.replace(/\/{2,}/g, "/");
  // Keep query: "/ps_and_as/?purchase=..."
  if (raw.startsWith("/?")) {
    return `${origin}${basePath}/${raw.slice(1)}`;
  }
  return `${origin}${joined.startsWith("/") ? joined : `/${joined}`}`;
}

/**
 * Express: POST /api/billing/create-checkout-session
 * Requires google auth middleware to set req.googleSub / req.playerId.
 */
async function createCheckoutSessionHandler(req, res) {
  const stripe = getStripe();
  const priceId = getPriceId();
  if (!stripe || !priceId) {
    return res.status(503).json({ error: "billing_not_configured" });
  }

  const playerId =
    req.googlePlayerId ||
    (req.googleSub ? `google:${req.googleSub}` : null);
  if (!playerId || !String(playerId).startsWith("google:")) {
    return res.status(401).json({ error: "google_required" });
  }

  const product = req.body?.product || REMOVE_ADS_PRODUCT;
  if (product !== REMOVE_ADS_PRODUCT) {
    return res.status(400).json({ error: "unknown_product" });
  }

  const successUrl = absoluteReturnUrl(
    req,
    req.body?.successPath || "/?purchase=remove_ads_success",
  );
  const cancelUrl = absoluteReturnUrl(
    req,
    req.body?.cancelPath || "/?purchase=remove_ads_cancel",
  );

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: playerId,
      metadata: {
        product: REMOVE_ADS_PRODUCT,
        playerId,
      },
      // Prefer NZD price in Stripe Dashboard; currency follows the Price object.
    });
    if (!session.url) {
      return res.status(500).json({ error: "no_checkout_url" });
    }
    return res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error("[billing] checkout create failed:", err?.message || err);
    return res.status(500).json({ error: "checkout_failed" });
  }
}

async function grantRemoveAds(playerId) {
  const { setAdsRemoved } = require("./playerStatsStore");
  return setAdsRemoved(playerId, true);
}

/**
 * Express raw-body webhook handler.
 */
async function stripeWebhookHandler(req, res) {
  const stripe = getStripe();
  const secret = getWebhookSecret();
  if (!stripe || !secret) {
    return res.status(503).send("billing_not_configured");
  }

  const sig = req.headers["stripe-signature"];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    console.warn("[billing] webhook signature failed:", err?.message || err);
    return res.status(400).send(`Webhook Error: ${err?.message || "invalid"}`);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const playerId =
        session.metadata?.playerId ||
        session.client_reference_id ||
        null;
      const product = session.metadata?.product || REMOVE_ADS_PRODUCT;
      if (
        playerId &&
        String(playerId).startsWith("google:") &&
        product === REMOVE_ADS_PRODUCT &&
        session.payment_status === "paid"
      ) {
        const entry = grantRemoveAds(playerId);
        console.log(
          "[billing] remove_ads granted:",
          playerId,
          entry?.updatedAt || "ok",
        );
      }
    }
  } catch (err) {
    console.error("[billing] webhook handler error:", err?.message || err);
    return res.status(500).send("handler_error");
  }

  return res.json({ received: true });
}

function isBillingConfigured() {
  return !!(getStripe() && getPriceId());
}

module.exports = {
  createCheckoutSessionHandler,
  stripeWebhookHandler,
  isBillingConfigured,
  REMOVE_ADS_PRODUCT,
};
