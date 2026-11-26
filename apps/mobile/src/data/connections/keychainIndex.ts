const indexKey = 'jhs_mobile_media_revision_keys_v1';

type IndexStore = { getItem(key: string): Promise<unknown>; setItem(key: string, value: unknown): Promise<unknown> };
type CredentialStore = {
  getValue(key: string, fallback?: unknown): Promise<unknown>;
  setValue(key: string, value: unknown): Promise<void>;
  removeValue(key: string): Promise<void>;
};

export function indexKeychainRevisions(database: IndexStore, credential: CredentialStore) {
  let writes: Promise<unknown> = Promise.resolve();
  const read = async () => (await database.getItem(indexKey) as string[] | null) ?? [];
  return {
    ...credential,
    async listValues() { await writes; return read(); },
    setValue(key: string, value: unknown) {
      const operation = writes.then(async () => {
        if (key.includes(':revision:')) {
          const keys = await read();
          // Record the name before the encrypted write. Missing values are ignored by CredentialService.
          if (!keys.includes(key)) await database.setItem(indexKey, [...keys, key]);
        }
        await credential.setValue(key, value);
      });
      writes = operation.catch(() => {});
      return operation;
    },
  };
}
