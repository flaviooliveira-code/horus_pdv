/**
 * Arquivo: src/pages/Admin/AboutPdvPage.tsx
 * Objetivo: apresenta informações institucionais do projeto (história, autoria, licença e visão futura).
 * Entradas esperadas: não recebe props; exibe conteúdo estático/documental do Hórus PDV.
 */

import { BookOpenText, Code2, HeartHandshake, Rocket } from "lucide-react";
import PageHeader from "@/components/Admin/PageHeader";
import PageLayout from "@/layout/PageLayout";

export default function AboutPdvPage() {
  return (
    <PageLayout className="space-y-4 py-4 md:space-y-6 md:py-6 lg:py-8">
      <PageHeader
        title="Sobre PDV"
        description="História, propósito e modelo de uso do projeto Hórus PDV."
      />

      <section className="card overflow-hidden">
        <div className="border-b border-border-primary bg-gradient-to-r from-secondary/8 via-bg-light to-accent/8 px-4 py-4 md:px-5">
          <h2 className="text-lg font-semibold text-text-primary">Projeto open source</h2>
          <p className="mt-1 text-sm text-text-secondary">
            O Hórus PDV é um projeto pessoal, aberto para estudo e uso da comunidade.
          </p>
        </div>

        <div className="space-y-4 p-4 md:p-5">
          <article className="rounded-xl border border-border-primary bg-bg-primary p-4">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-text-primary">
              <BookOpenText size={16} className="text-accent" />
              Linha do tempo
            </p>
            <p className="mt-2 text-sm text-text-secondary">
              O projeto foi criado em <strong>2020</strong> e evoluiu com várias melhorias de
              arquitetura, usabilidade e organização até esta versão de <strong>2026</strong>.
            </p>
          </article>

          <article className="rounded-xl border border-border-primary bg-bg-primary p-4">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-text-primary">
              <HeartHandshake size={16} className="text-accent" />
              Uso gratuito
            </p>
            <p className="mt-2 text-sm text-text-secondary">
              Esta versão pode ser usada gratuitamente, desde que sejam mantidos os devidos
              créditos ao projeto e ao autor.
            </p>
            <div className="mt-3 space-y-1 text-sm text-text-secondary">
              <p>
                Autor: <strong className="text-text-primary">Flávio Oliveira</strong>
              </p>
              <p>
                GitHub:{" "}
                <a
                  href="https://github.com/flaviooliveira-code"
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent hover:underline"
                >
                  github.com/flaviooliveira-code
                </a>
              </p>
              <p>
                LinkedIn:{" "}
                <a
                  href="https://www.linkedin.com/in/fladoliveira"
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent hover:underline"
                >
                  linkedin.com/in/fladoliveira
                </a>
              </p>
            </div>
          </article>

          <article className="rounded-xl border border-border-primary bg-bg-primary p-4">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-text-primary">
              <Code2 size={16} className="text-accent" />
              Objetivo da versão atual
            </p>
            <p className="mt-2 text-sm text-text-secondary">
              Entregar uma base sólida para operação de PDV, com foco em produtividade, clareza
              de fluxo e facilidade de evolução.
            </p>
          </article>

          <article className="rounded-xl border border-border-primary bg-bg-primary p-4">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-text-primary">
              <Rocket size={16} className="text-accent" />
              Próximos passos
            </p>
            <p className="mt-2 text-sm text-text-secondary">
              Futuramente poderá existir uma versão paga com módulos adicionais e recursos
              avançados, mantendo a versão atual como referência aberta.
            </p>
          </article>
        </div>
      </section>
    </PageLayout>
  );
}
