import assert from "node:assert/strict";
import { test } from "node:test";

import { rotateRefreshTokenCore } from "@/server/auth/refresh-token-rotation-core";

type StoreState = {
  oldValid: boolean;
  newJtis: string[];
};

function transactionalState(initial: StoreState) {
  let state = structuredClone(initial);
  return {
    get state() {
      return state;
    },
    run: async (fn: (draft: StoreState) => Promise<boolean>) => {
      const draft = structuredClone(state);
      const result = await fn(draft);
      state = draft;
      return result;
    },
  };
}

test("rotacao registra o novo JTI e revoga o anterior na mesma transacao", async () => {
  const store = transactionalState({ oldValid: true, newJtis: [] });
  const issued = await rotateRefreshTokenCore({
    issue: async () => ({ refreshJti: "new-jti" }),
    runTransaction: store.run,
    claim: async (draft) => {
      if (!draft.oldValid) return false;
      draft.oldValid = false;
      return true;
    },
    register: async (draft, next) => {
      draft.newJtis.push(next.refreshJti);
    },
  });

  assert.deepEqual(issued, { refreshJti: "new-jti" });
  assert.equal(store.state.oldValid, false);
  assert.deepEqual(store.state.newJtis, ["new-jti"]);
});

test("falha ao registrar novo JTI preserva o refresh anterior por rollback", async () => {
  const store = transactionalState({ oldValid: true, newJtis: [] });

  await assert.rejects(
    rotateRefreshTokenCore({
      issue: async () => ({ refreshJti: "new-jti" }),
      runTransaction: store.run,
      claim: async (draft) => {
        draft.oldValid = false;
        return true;
      },
      register: async () => {
        throw new Error("insert falhou");
      },
    }),
    /insert falhou/
  );

  assert.equal(store.state.oldValid, true);
  assert.deepEqual(store.state.newJtis, []);
});

test("claim rejeitado nao registra nem devolve um novo par", async () => {
  const store = transactionalState({ oldValid: false, newJtis: [] });
  let registerCalls = 0;
  const issued = await rotateRefreshTokenCore({
    issue: async () => ({ refreshJti: "unused-jti" }),
    runTransaction: store.run,
    claim: async () => false,
    register: async () => {
      registerCalls += 1;
    },
  });

  assert.equal(issued, null);
  assert.equal(registerCalls, 0);
  assert.equal(store.state.oldValid, false);
});
