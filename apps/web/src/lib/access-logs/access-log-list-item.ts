export type AccessLogListSnakeRow = {
  id: number;
  user_id: number | null;
  user_nome: string | null;
  user_email: string;
  ip_origem: string | null;
  browser: string | null;
  status: string | null;
  user_agent: string | null;
  created_at: Date | null;
};

export type AccessLogListItem = {
  id: number;
  userId: number | null;
  userNome: string | null;
  userEmail: string;
  ipOrigem: string | null;
  browser: string | null;
  status: string | null;
  userAgent: string | null;
  createdAt: Date | null;
};

export function toAccessLogListItem(row: AccessLogListSnakeRow): AccessLogListItem {
  return {
    id: row.id,
    userId: row.user_id,
    userNome: row.user_nome,
    userEmail: row.user_email,
    ipOrigem: row.ip_origem,
    browser: row.browser,
    status: row.status,
    userAgent: row.user_agent,
    createdAt: row.created_at,
  };
}
