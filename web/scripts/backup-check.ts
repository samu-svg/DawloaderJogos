if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL ausente. Sem ela não há como apontar o Postgres do Supabase em um incidente.",
  );
  process.exit(1);
}

console.log(
  "backup-check: projeto Supabase definido. Confirme PITR no painel e versionamento no R2.",
);
