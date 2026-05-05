import webpush from "web-push";

export async function sendPush(
  subscription: webpush.PushSubscription,
  payload: { title: string; body: string; url?: string; tag?: string }
) {
  webpush.setVapidDetails(
    "mailto:shohei.matsumoto@pacific-meta.co.jp",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
  await webpush.sendNotification(subscription, JSON.stringify(payload));
}
