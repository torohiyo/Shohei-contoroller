import { Redis } from "@upstash/redis";

let _redis: Redis | null = null;

export function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return _redis;
}

export const redis = {
  get: <T>(key: string) => getRedis().get<T>(key),
  set: (key: string, value: string) => getRedis().set(key, value),
  del: (key: string) => getRedis().del(key),
};
