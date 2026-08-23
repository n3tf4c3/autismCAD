export async function rotateRefreshTokenCore<TExecutor, TIssued>(params: {
  issue: () => Promise<TIssued>;
  runTransaction: (fn: (executor: TExecutor) => Promise<boolean>) => Promise<boolean>;
  claim: (executor: TExecutor) => Promise<boolean>;
  register: (executor: TExecutor, issued: TIssued) => Promise<void>;
}): Promise<TIssued | null> {
  // O par e gerado antes da transacao para que claim + registro sejam as unicas
  // operacoes persistentes dentro da fronteira atomica.
  const issued = await params.issue();
  const rotated = await params.runTransaction(async (executor) => {
    const claimed = await params.claim(executor);
    if (!claimed) return false;
    await params.register(executor, issued);
    return true;
  });

  return rotated ? issued : null;
}
