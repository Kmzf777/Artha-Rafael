# CLAUDE.md e workflow do Claude Code: o que as fontes oficiais dizem

Pesquisa de 2026-10-16. Pergunta: as recomendações que motivaram a reescrita do
`CLAUDE.md` deste repo batem com a documentação oficial da Anthropic? E qual
workflow e quais hooks fazem sentido aqui?

Fontes primárias lidas nesta data (todas em `code.claude.com/docs/en/`):
[memory](https://code.claude.com/docs/en/memory),
[best-practices](https://code.claude.com/docs/en/best-practices),
[hooks-guide](https://code.claude.com/docs/en/hooks-guide),
[hooks](https://code.claude.com/docs/en/hooks),
[permissions](https://code.claude.com/docs/en/permissions),
[permission-modes](https://code.claude.com/docs/en/permission-modes),
[worktrees](https://code.claude.com/docs/en/worktrees). Fora da Anthropic:
[Vercel, Git deployments](https://vercel.com/docs/git) (fonte primária do
comportamento de deploy) e o README do
[obra/superpowers](https://github.com/obra/superpowers) (complemento, não é doc
oficial da Anthropic).

Citações entre aspas são literais das páginas. Segunda conferência no mesmo dia,
contra o Markdown das páginas (`<url>.md`): todas batem. Dois pontos que os hooks
da seção 4 dependem e que ela confirmou: regra `PowerShell(...)` "use[s] the same
shape as Bash rules" ([permissions](https://code.claude.com/docs/en/permissions)),
e em exec form "path placeholders ... are substituted into `command` and into
each `args` element as plain strings", além de exportados como variável de
ambiente `CLAUDE_PROJECT_DIR` ([hooks](https://code.claude.com/docs/en/hooks#exec-form-and-shell-form)).

## 1. CLAUDE.md: cada afirmação conferida

| Afirmação | Veredito | Fonte |
| --- | --- | --- |
| Alvo abaixo de 200 linhas por arquivo | Confirmada. "target under 200 lines per CLAUDE.md file. Longer files consume more context and reduce adherence." | [memory](https://code.claude.com/docs/en/memory) |
| Incluir só o que o Claude não infere | Confirmada. Tabela Include/Exclude: incluir comandos que ele não adivinha, estilo que difere do padrão, etiqueta de repo, decisões de arquitetura, peculiaridades de ambiente, gotchas. Excluir o que se lê no código, convenções padrão, docs de API, "Information that changes frequently", tutoriais, "File-by-file descriptions of the codebase" | [best-practices](https://code.claude.com/docs/en/best-practices#write-an-effective-claude-md) |
| Teste de cada linha | "Would removing this cause Claude to make mistakes?" If not, cut it. Bloated CLAUDE.md files cause Claude to ignore your actual instructions!" | [best-practices](https://code.claude.com/docs/en/best-practices#write-an-effective-claude-md) |
| Instruções contraditórias | Confirmada. "if two instructions contradict each other, Claude may pick one arbitrarily." | [memory](https://code.claude.com/docs/en/memory) |
| "IMPORTANT" com parcimônia | Confirmada, e mais estrita que "1 a 2 linhas": "add emphasis such as "IMPORTANT" to that line alone. If you emphasize many lines, none of them stands out." | [best-practices](https://code.claude.com/docs/en/best-practices#write-an-effective-claude-md) |
| Regras de escopo parcial em `.claude/rules/` com `paths:` | Confirmada. "A path-scoped rule loads when Claude uses the Read, Write, or Edit tool on a matching file", e também em `cat`/`head` de um arquivo. Sem `paths`, a regra carrega no início como o CLAUDE.md. `paths` é o único campo lido; YAML que não parseia faz a regra carregar como se não tivesse `paths` | [memory](https://code.claude.com/docs/en/memory#path-specific-rules) |
| `@imports` não economizam contexto | Confirmada. "Imports help you organize a long file but don't reduce its context cost, because imported files also load at launch." | [memory](https://code.claude.com/docs/en/memory) |
| Comentário HTML some antes do contexto | Confirmada, com ressalva: vale para comentário de bloco; "Comments inside code blocks are preserved." | [memory](https://code.claude.com/docs/en/memory) |
| O que precisa valer sempre vira hook | Confirmada. CLAUDE.md é "context, not enforced configuration. To block an action regardless of what Claude decides, use a PreToolUse hook instead." E: "Unlike CLAUDE.md instructions which are advisory, hooks are deterministic" | [memory](https://code.claude.com/docs/en/memory), [best-practices](https://code.claude.com/docs/en/best-practices#set-up-hooks) |

Achados extras que valem para este repo:

- **`.claude/` estava inteiro no `.gitignore`.** Com isso `.claude/rules/` nunca
  seria versionado e as regras existiriam só na máquina de quem as escreveu. A
  reescrita troca `.claude/` por `.claude/*` com exceção para `.claude/rules/`.
- **Auditoria embutida.** `/doctor prompt-audit` procura instruções desatualizadas,
  referências a arquivo que não existe e contradições entre arquivos, e só aplica
  com ordem explícita ([memory](https://code.claude.com/docs/en/memory#audit-your-instruction-files)).
  Vale rodar depois de cada onda grande.
- **Subagente em worktree não lê as regras da worktree.** "A subagent in its own
  worktree takes the instruction files it starts with from your main
  conversation, not from its worktree. When that worktree is in the default
  location under `.claude/worktrees/`, the subagent also doesn't load the
  `CLAUDE.md` file or `.claude/rules/` directory at the worktree's root"
  ([worktrees](https://code.claude.com/docs/en/worktrees#isolate-subagents-with-worktrees)).
  Consequência: mudança em regra só vale para subagente depois do merge na
  checkout principal.
- **`.env.local` não vai para worktree sozinho.** Worktree é checkout limpo; um
  `.worktreeinclude` na raiz com `.env.local` copia o arquivo em cada worktree
  criada pelo Claude Code ([worktrees](https://code.claude.com/docs/en/worktrees#copy-gitignored-files-into-worktrees)).
  Hoje, sem isso, os 14 testes de paridade com o Postgres pulam numa worktree.

## 2. Hooks e permissões: o que importa para o desenho

- **Onde mora.** `.claude/settings.json` é o arquivo versionável do projeto;
  `.claude/settings.local.json` é pessoal ([hooks-guide](https://code.claude.com/docs/en/hooks-guide#configure-hook-location)).
  Como `.claude/` está no `.gitignore`, versionar `settings.json` exige mais uma
  exceção lá.
- **Shell no Windows.** Hook em forma de shell (sem `args`) roda em "Git Bash on
  Windows, or PowerShell when Git Bash isn't installed". Com `args`, é exec form,
  sem shell, e "exec form requires `command` to resolve to a real executable such
  as a `.exe`. The `.cmd` and `.bat` shims that npm, npx, eslint ... can't be
  spawned without a shell"; a saída indicada é `node` mais o caminho do script
  ([hooks](https://code.claude.com/docs/en/hooks#exec-form-and-shell-form)).
  Os exemplos oficiais usam `jq`, que **não está instalado** nesta máquina; por
  isso os hooks propostos abaixo leem o JSON com Node.
- **Worktrees.** "`${CLAUDE_PROJECT_DIR}` stays put" (aponta para a checkout onde
  a sessão começou) e "`cwd` follows Claude" ([hooks](https://code.claude.com/docs/en/hooks#reference-scripts-by-path)).
  Hook que precisa do diretório de trabalho real lê `cwd` do stdin.
- **Exit 2 por evento.** Em `PreToolUse` bloqueia a chamada; em `PostToolUse`
  "Shows stderr to Claude; the tool already ran" ([hooks](https://code.claude.com/docs/en/hooks)).
  Ou seja, lint pós-edição não desfaz nada, só devolve o erro para o Claude
  corrigir.
- **Push na `main` em auto mode passa sem perguntar.** A lista "Allowed by
  default" do classificador inclui "Pushing to any branch of the repository
  you're working in, including the default branch". Para manter um ponto de
  controle humano, a doc indica `permissions.ask`: "Ask rules that match on a
  command's content, such as `Bash(git push *)`, fall back to a permission
  prompt" ([permission-modes](https://code.claude.com/docs/en/permission-modes#what-the-classifier-blocks-by-default)).
  Regra de ask também vale dentro de comando composto, "even in auto mode"
  ([permissions](https://code.claude.com/docs/en/permissions)).
- **Hook não é a ferramenta para allow/deny duro.** Sobre o filtro `if` dos hooks:
  "Because the filter is best-effort, use the permission system rather than a hook
  to enforce a hard allow or deny" ([hooks-guide](https://code.claude.com/docs/en/hooks-guide)).
  E a regra de permissão também tem limite: `Bash(git push *)` não pega
  `git -C . push origin main` ([permissions](https://code.claude.com/docs/en/permissions#bash-rule-limits)).
  Para o caso aqui (pedir confirmação, não blindar), regra `ask` basta.
- **Vercel.** "A Production deployment will be created each time you merge to the
  production branch", que por padrão é `main`; os outros branches viram Preview
  a cada push ([Vercel](https://vercel.com/docs/git)). Push de branch de worktree
  gera preview, não produção.

## 3. Workflow recomendado para este projeto

O que as fontes oficiais pedem, e onde as skills do superpowers encaixam. O
superpowers é complemento: a ordem das skills vem do README dele (brainstorming,
using-git-worktrees, writing-plans, subagent-driven-development ou
executing-plans, test-driven-development, requesting-code-review,
finishing-a-development-branch), não da Anthropic.

1. **Explorar antes de planejar, planejar antes de codar.** A doc oficial separa
   Explore, Plan, Implement, Commit e diz quando pular: "If you could describe
   the diff in one sentence, skip the plan" ([best-practices](https://code.claude.com/docs/en/best-practices#explore-first-then-plan-then-code)).
   Aqui: `superpowers:brainstorming` e a spec em `docs/superpowers/specs/` cobrem
   o "Explore + entrevista"; a doc oficial recomenda que a spec nomeie arquivos e
   interfaces, diga o que está fora de escopo e termine com uma verificação ponta
   a ponta, e que a execução comece numa sessão nova
   ([best-practices](https://code.claude.com/docs/en/best-practices#let-claude-interview-you)).
   Correção de uma linha não passa por brainstorming nem plano.
2. **Investigação vai para subagente.** "Delegate research with "use subagents to
   investigate X". They explore in a separate context"
   ([best-practices](https://code.claude.com/docs/en/best-practices#use-subagents-for-investigation)).
   Varredura de código ou leitura de doc externa não deve encher a sessão que vai
   implementar.
3. **Plano executável, com verificação em cada passo.** `superpowers:writing-plans`
   já exige passos com critério de checagem, o que casa com "Give Claude a check
   it can run: tests, a build, a screenshot to compare"
   ([best-practices](https://code.claude.com/docs/en/best-practices#give-claude-a-way-to-verify-its-work)).
   Aqui o "check" é `npm test`, `npx tsc --noEmit`, `npm run lint` e, para o bot,
   o teste de roteiro. O que não tem teste (tela, WhatsApp real) precisa de
   evidência registrada, como o ROADMAP já faz em "O que NÃO está provado".
4. **Execução em worktree, um subagente por tarefa, arquivos disjuntos.**
   `superpowers:subagent-driven-development` despacha um subagente por tarefa;
   worktrees isolam edição ("run separate CLI sessions in isolated git checkouts
   so edits don't collide", [best-practices](https://code.claude.com/docs/en/best-practices#run-multiple-claude-sessions)).
   Atenção ao achado da seção 1: subagente em worktree usa as regras da sessão
   principal, não as da worktree.
5. **Revisor adversarial em contexto limpo.** "Before treating a task as done,
   have a subagent review the diff in a fresh context and report gaps", e o
   aviso: "Tell the reviewer to flag only gaps that affect correctness or the
   stated requirements" ([best-practices](https://code.claude.com/docs/en/best-practices#add-an-adversarial-review-step)).
   Encaixa em `superpowers:requesting-code-review` ou no `/code-review`. O
   ROADMAP de 2026-09-28 mostra o porquê: três quebras com lint, tsc, build e 301
   testes verdes.
6. **Evidência antes de "pronto".** `superpowers:verification-before-completion`
   implementa o "Have Claude show evidence rather than asserting success"
   ([best-practices](https://code.claude.com/docs/en/best-practices#give-claude-a-way-to-verify-its-work)).
7. **Fechar o branch com o dono no circuito.** `superpowers:finishing-a-development-branch`
   oferece merge, PR, manter ou descartar. Aqui merge na `main` é deploy de
   produção, então a opção padrão é PR ou branch mantido, e o merge espera o ok
   do dono. A regra `ask` da seção 4 torna isso mecânico em vez de depender de
   memória.
8. **`/clear` entre tarefas.** "Use `/clear` frequently between tasks", e depois
   de duas correções falhas no mesmo ponto, `/clear` e um prompt melhor
   ([best-practices](https://code.claude.com/docs/en/best-practices#manage-context-aggressively)).
9. **O que precisa acontecer sempre vira hook ou permissão, não frase.** "If
   Claude already does something correctly without the instruction, delete it or
   convert it to a hook" ([best-practices](https://code.claude.com/docs/en/best-practices#avoid-common-failure-patterns)).

## 4. Hooks propostos (não implementados)

Os três exigem acrescentar ao `.gitignore`, depois de `!.claude/rules/`:

```gitignore
!.claude/settings.json
!.claude/hooks/
```

### 4.1 ESLint no arquivo editado (PostToolUse)

Roda só em `.ts`/`.tsx`, devolve o erro ao Claude por exit 2. Custo medido nesta
máquina: cerca de 9 s por arquivo. Lê `cwd` do stdin para funcionar em worktree
e acha o ESLint pela checkout principal (`CLAUDE_PROJECT_DIR`), porque worktree
nova não tem `node_modules`.

`.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "node",
            "args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/lint-arquivo.mjs"],
            "timeout": 60
          }
        ]
      }
    ]
  }
}
```

`.claude/hooks/lint-arquivo.mjs`:

```js
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

let bruto = ''
for await (const parte of process.stdin) bruto += parte
const entrada = JSON.parse(bruto)
const arquivo = entrada.tool_input?.file_path ?? ''
if (!/\.(ts|tsx)$/.test(arquivo)) process.exit(0)

const eslint = join(process.env.CLAUDE_PROJECT_DIR, 'node_modules', 'eslint', 'bin', 'eslint.js')
const r = spawnSync(process.execPath, [eslint, arquivo], { cwd: entrada.cwd, encoding: 'utf8' })
if (r.status === 0) process.exit(0)
process.stderr.write(`ESLint falhou em ${arquivo}:\n${r.stdout}${r.stderr}`)
process.exit(2)
```

### 4.2 Confirmação antes de qualquer `git push` (regra `ask`, não hook)

O exemplo pedido era um PreToolUse. A doc indica o sistema de permissões para
isso (seção 2), e a regra `ask` continua perguntando em auto mode, onde o
classificador deixaria o push na `main` passar. Pergunta em todo push, não só na
`main`, porque `git push` sem argumentos estando na `main` também publica e a
regra casa texto, não destino.

```json
{
  "permissions": {
    "ask": [
      "Bash(git push *)",
      "PowerShell(git push *)"
    ]
  }
}
```

Limite documentado: não pega formas como `git -C . push`. Para blindar de
verdade, proteção de branch no GitHub.

### 4.3 Type-check ao fim do turno (Stop)

`npx tsc --noEmit` leva cerca de 11 s aqui; por edição seria caro, por turno é
aceitável. A doc chama o Stop hook de "deterministic gate" e avisa do limite de
bloqueios seguidos ([best-practices](https://code.claude.com/docs/en/best-practices#give-claude-a-way-to-verify-its-work),
[hooks-guide](https://code.claude.com/docs/en/hooks-guide#stop-hook-hits-the-block-cap)).
O script sai cedo se `stop_hook_active` vier verdadeiro, para não prender o
Claude em laço.

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node",
            "args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/tsc-no-fim.mjs"],
            "timeout": 120
          }
        ]
      }
    ]
  }
}
```

`.claude/hooks/tsc-no-fim.mjs`:

```js
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

let bruto = ''
for await (const parte of process.stdin) bruto += parte
const entrada = JSON.parse(bruto)
if (entrada.stop_hook_active) process.exit(0)

const tsc = join(process.env.CLAUDE_PROJECT_DIR, 'node_modules', 'typescript', 'bin', 'tsc')
const r = spawnSync(process.execPath, [tsc, '--noEmit'], { cwd: entrada.cwd, encoding: 'utf8' })
if (r.status === 0) process.exit(0)
process.stderr.write(`tsc --noEmit falhou:\n${r.stdout}`)
process.exit(2)
```

Os três juntos ficam num só `.claude/settings.json`, com `hooks.PostToolUse`,
`hooks.Stop` e `permissions.ask` lado a lado. Depois de criar, conferir com
`/hooks` e testar à mão, como a doc sugere:
`echo '{"tool_input":{"file_path":"src/lib/tabs.ts"},"cwd":"."}' | CLAUDE_PROJECT_DIR="$PWD" node .claude/hooks/lint-arquivo.mjs; echo $?`
(no Git Bash; fora do Claude Code a variável não existe e tem de ser passada).
