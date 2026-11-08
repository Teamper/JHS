/** Script-private GM storage shared across origins, with per-frame cached reads. */
export async function installSharedGmFixture(context) {
  const records = new Map(), frames = new Set(), binding = `__jhsSharedGm${crypto.randomUUID().replaceAll("-", "")}`;
  await context.exposeBinding(binding, async ({ frame }, message) => {
    records.set(message.key, { value: message.value, deleted: message.deleted === true });
    await Promise.all([...frames].filter(target => target !== frame && !target.isDetached()).map(target => target.evaluate(message => {
      window.__jhsSharedGmReceive?.(message);
    }, message).catch(() => {})));
  });
  return {
    async attach(frame) {
      frames.add(typeof frame.mainFrame === "function" ? frame.mainFrame() : frame);
      await frame.evaluate(({ binding, entries }) => {
        const cache = new Map(entries), listeners = new Map();
        const previousGet = window.GM_getValue, previousSet = window.GM_setValue, previousDelete = window.GM_deleteValue;
        let sequence = 0;
        const receive = (message, remote) => {
          const previous = window.GM_getValue(message.key);
          cache.set(message.key, { value: message.value, deleted: message.deleted === true });
          for (const item of listeners.values()) if (item.key === message.key) item.callback(message.key, previous, message.deleted ? undefined : message.value, remote);
        };
        window.__jhsSharedGmReceive = message => receive(message, true);
        const publish = message => { receive(message, false); void window[binding](message).catch(() => {}); };
        window.GM_getValue = (key, fallback) => cache.has(key) ? cache.get(key).deleted ? fallback : structuredClone(cache.get(key).value) : previousGet(key, fallback);
        window.GM_setValue = (key, value) => { previousSet(key, value); publish({ key, value }); };
        window.GM_deleteValue = key => { previousDelete(key); publish({ key, deleted: true }); };
        window.GM_listValues = () => [...cache].filter(([, value]) => !value.deleted).map(([key]) => key);
        window.GM_addValueChangeListener = (key, callback) => { listeners.set(++sequence, { key, callback }); return sequence; };
        window.GM_removeValueChangeListener = id => listeners.delete(id);
      }, { binding, entries: [...records] });
    },
    records,
  };
}
