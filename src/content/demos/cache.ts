export class Cache {
    /** ttl 单位：秒 */
    static set(key: string, value: any, ttl: number) {
        localStorage.setItem(key, JSON.stringify({ value, ttl: Date.now() + ttl * 1000 }));
    }
    static get(key: string) {
        const item = localStorage.getItem(key);
        if (!item) return null;
        const { value, ttl } = JSON.parse(item);
        if (ttl < Date.now()) {
            localStorage.removeItem(key);
            return null;
        }
        return value;
    }
}