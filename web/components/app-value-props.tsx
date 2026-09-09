const INCLUDED = [
  {
    title: "Licença do app",
    text: "MontaHD para Windows 10/11 (32 e 64-bit) e Windows 7/8/8.1 (linha legado), com atualizações enquanto o plano estiver ativo.",
  },
  {
    title: "Acervo em lote",
    text: "Selecione vários jogos ou o acervo inteiro — sem clicar título por título.",
  },
  {
    title: "Velocidade cheia",
    text: "Download sem teto no app. No plano grátis a velocidade fica limitada.",
  },
  {
    title: "Sem anúncios",
    text: "Qualquer pasta do HD, sem limite de PCs e sem anúncio, encurtador ou espera.",
  },
];

export function AppValueProps() {
  return (
    <section>
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          O que o plano libera
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          O pagamento é pelo software. Os arquivos do acervo entram junto enquanto
          o acesso estiver ativo.
        </p>
      </div>
      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        {INCLUDED.map((item) => (
          <li
            key={item.title}
            className="flex gap-3 rounded-2xl border border-border/70 bg-surface/60 px-4 py-3.5"
          >
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[11px] font-bold text-accent-hover">
              ✓
            </span>
            <div>
              <p className="text-sm font-medium text-white">{item.title}</p>
              <p className="mt-0.5 text-xs leading-5 text-zinc-500">{item.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
