# Company Pulse

🏢 MRCP-Business & Analisador de Empresas

Especificação de Produto e Arquitetura Técnica Unificada (PRD)

1. Visão Geral e Posicionamento do Produto

O MRCP-Business & Analisador de Empresas unifica um motor determinístico de governança corporativa local (Omni-Parser) a uma ferramenta pública de captura e inteligência de mercado orientada a dados públicos de empresas (CNPJ).

A plataforma opera em dois eixos interdependentes:

 * Front-facing (Analisador de Empresas): Ferramenta web gratuita que gera um diagnóstico instantâneo (Nota A–F e indicadores macro) sobre a presença, saúde cadastral, risco jurídico e reputação da empresa consultada. Atua como motor de atração de demanda e captação de leads qualificados.

 * Core Engine (MRCP-Business Middleware): Motor determinístico local (local-first) que extrai, normaliza e compila documentos empresariais estruturados e desestruturados (processos judiciais, certidões, diários oficiais, balanços e contratos) em micro-contratos JSON estritos. Isso elimina o "AI Tax" (gastos abusivos com tokens em modelos de linguagem), impede alucinações e anonimiza dados conforme a LGPD antes de qualquer interação externa.

┌────────────────────────────────────────────────────────────────────────┐

│                        Camada de Consumo / UI                          │

│   Landing Pública (CNPJ)  │  Área de Leads  │  MCP Server / API Corporativa │

└───────────────────▲─────────────────▲────────────────────▲─────────────┘

                    │                 │                    │

┌───────────────────┴─────────────────┴────────────────────┴─────────────┐

│                 MRCP-Business (Deterministic Core Engine)              │

│                                                                        │

│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │

│  │ Pipeline         │  │ Pipeline         │  │ Pipeline             │  │

│  │ Cadastral & Fin. │  │ Jurídica (DQI)   │  │ Reputacional & Oper. │  │

│  └────────▲─────────┘  └────────▲─────────┘  └──────────▲───────────┘  │

│           │                     │                       │              │

│  ┌────────┴─────────────────────┴───────────────────────┴───────────┐  │

│  │          Motor de Scoring A–F & Atribuição Determinística        │  │

│  └──────────────────────────────▲───────────────────────────────────┘  │

│                                 │                                      │

│  ┌──────────────────────────────┴───────────────────────────────────┐  │

│  │   StealthScraper & SERP Adapter (curl_cffi, selectolax, proxies) │  │

│  └──────────────────────────────────────────────────────────────────┘  │

└─────────────────────────────────▲──────────────────────────────────────┘

                                  │

┌─────────────────────────────────┴──────────────────────────────────────┐

│                    Persistência & Base de Conhecimento                 │

│         PostgreSQL (JSONB Micro-Contratos)  │  Redis (Cache 30d)        │

└────────────────────────────────────────────────────────────────────────┘



2. Jornada do Usuário e Funil de Conversão (GTM)

O produto adota o princípio de relatório deliberadamente incompleto: o motor executa a análise interna completa, mas exibe apenas um resumo macro com gatilhos de conversão.

flowchart TD

  A["1. Landing Page"] --> B["Usuário insere CNPJ"]

  B --> C{"CNPJ válido?"}

  C -- "Não" --> B

  C -- "Sim" --> D["Modal de Consentimento (LGPD)"]

  D --> E["Botão: Analisar Agora"]

  E --> F["Processamento MRCP-Business<br/>(Cache ou Pipeline 10–30s)"]

  F --> G["2. RELATÓRIO MÍNIMO<br/>Nota A–F + 4 Indicadores"]

  G --> H{"Deseja detalhamento?"}

  H -- "Sim" --> I["3. Captura de E-mail (Lead)<br/>+ Opt-in"]

  I --> J["Double Opt-in (Link Mágico)"]

  J --> K["4. RELATÓRIO ESTENDIDO<br/>(Volumetria e Alertas Macro)"]

  K --> L["5. CTA: Inteligência Completa<br/>MRCP-Business B2B"]

  L --> M["Contato Comercial / Dossiê 360°"]



2.1. Níveis de Entrega de Informação

| Nível | Disponibilidade | Conteúdo Entregue | Objetivo Estratégico |

|---|---|---|---|

| Nível 1: Relatório Mínimo | Gratuito e público (sem login) | Nota global A–F, 4 faróis macro (Cadastral, Presença, Processos, Reputação), contagem de pontos de atenção. | Curiosidade, compartilhamento orgânico e validação de interesse. |

| Nível 2: Relatório Estendido | Gratuito mediante e-mail confirmado (double opt-in) | Contagem agregada (ex.: 3 processos, 12 reclamações com 60% respondidas), canais sociais mapeados, idade do CNPJ e benchmark setorial simples. Sem nomes, links ou valores. | Qualificação de lead e identificação de perfil (dono da empresa vs. terceiro via domínio do e-mail). |

| Nível 3: Dossiê Completo (Serviço Pago) | Comercial / Contrato B2B | Dossiê 360° com links de fontes, valores de causas, identificação de partes, histórico temporal, análise de concorrentes e acesso aos micro-contratos JSON via API/MCP. | Monetização e venda recorrente de inteligência competitiva. |

3. Arquitetura dos Pipelines Determinísticos (MRCP-Business)

O MRCP-Business substitui a interpretação puramente probabilística de LLMs por extração baseada em parsers binários, heurísticas determinísticas e compilação em micro-contratos JSON.

Documentos / Web Scraped ──► [Parsers CPU / Regex / Heurísticas] ──► Micro-Contrato JSON ──► Scoring / Agentes IA

(PDF, DOCX, XLSX, HTML)      (Zero consumo de tokens de entrada)     (Compacto, estrito)      (Sem alucinações)



3.1. Pipeline Cadastral e Societário (RFB & Governança)

 * Entrada: CNPJ normalizado.

 * Fontes: API de CNPJ própria com redundância (BrasilAPI, ReceitaWS).

 * Processamento:

   * Extração de Razão Social, Nome Fantasia, CNAE Primário/Secundários, Porte, Capital Social e Quadro de Sócios e Administradores (QSA).

   * Cálculo determinístico de idade do negócio e mapeamento do quadro de administradores.

 * Micro-Contrato de Saída (cadastral_contrato):

   {

  "cnpj": "00.000.000/0000-00",

  "razao_social": "EMPRESA EXEMPLO LTDA",

  "nome_fantasia": "EXEMPLO DIGITAL",

  "situacao": "ATIVA",

  "data_abertura": "2018-05-12",

  "idade_anos": 8,

  "porte": "DEMAIS",

  "cnae_principal": {"codigo": "6201-5/01", "descricao": "Desenvolvimento de programas de computador sob encomenda"},

  "socios": [

    {"nome": "FULANO DE TAL", "qualificacao": "Sócio-Administrador", "entrada": "2018-05-12"}

  ]

}



3.2. Pipeline Jurídico e Risco Processual (Jusbrasil, Diários Oficiais e Tribunais)

 * Entrada: Consultas automatizadas no Judiciário (jusbrasil.com.br, *.jus.br, diários oficiais estaduais e federais).

 * Processamento Determinístico (Omni-Parser Jurídico):

   * Identificação de número CNJ do processo, tribunal de origem (TJSP, TRF, TRT) e classe processual.

   * Cálculo do Document Quality Index (DQI) sobre as publicações legais: isolamento de termos-chave (penhora, execução fiscal, falência, trabalhista).

   * Atribuição estrita: distinção entre processo contra a Pessoa Jurídica e processo contra Sócio (apenas considerado para o score se houver correlação com a atividade empresarial ou decisão que atinja o administrador).

 * Micro-Contrato de Saída (juridico_contrato):

   {

  "total_processos_empresa": 3,

  "total_processos_socios_atribuidos": 1,

  "distribuicao_polos": {"polo_passivo": 3, "polo_ativo": 0},

  "esferas": {"trabalhista": 2, "civel": 1, "fiscal": 0},

  "alertas_criticos": ["execucao_fiscal_ativa"]

}



3.3. Pipeline Reputacional e Operacional (Reclamações, Consumidor.gov e Redes)

 * Entrada: Varreduras em reclameaqui.com.br, consumidor.gov.br, SERP de redes sociais ([linkedin.com/company](https://linkedin.com/company), instagram.com).

 * Processamento Determinístico:

   * Extração matemática do volume de reclamações nos últimos 12 meses e taxa de resolução/resposta via seletores precisos (selectolax).

   * Verificação de presença digital verificada: checagem de código HTTP 200, links cruzados e timestamps de publicações recentes para atestar atividade.

 * Micro-Contrato de Saída (reputacional_contrato):

   {

  "reclame_aqui": {

    "reclamacoes_12m": 12,

    "percentual_respondidas": 0.60,

    "indice_solucao": 0.55,

    "status": "RUIM"

  },

  "presenca_digital": {

    "redes_ativas": ["instagram", "linkedin"],

    "website_ativo": true,

    "status_geral": "MODERADA"

  }

}



3.4. Pipeline de Documentação Interna (Exclusivo do Serviço Pago / B2B)

 * Escopo: Aplicado quando a empresa contrata a auditoria aprofundada ou carrega seus próprios arquivos (contratos em PDF/DOCX, planilhas orçamentárias XLSX/CSV ou modelos Power BI PBIX).

 * Processamento:

   * Dissecação de DAX, fórmulas de comissão e Power Query M sem carregar bases inteiras de dados para o modelo de linguagem.

   * Extração de cláusulas contratuais (rescisão, multas, SLA, confidencialidade) transformadas em pares chave-valor.

   * Anonimização de dados antes do envio para qualquer camada de resumo.

4. Pipeline de Análise Externa (Lifecycle da Consulta)

sequenceDiagram

  autonumber

  actor User as Usuário Web / API

  participant Cache as Redis (TTL 30d)

  participant Worker as Celery / FastAPI Worker

  participant Base as API CNPJ (RFB)

  participant Search as SERP Adapter (Serper/DDG)

  participant Scrape as StealthScraper (curl_cffi)

  participant MRCP as MRCP-Business Core

  participant DB as PostgreSQL (Acervo)



  User->>Worker: POST /analyze {cnpj}

  Worker->>Cache: Verificar CNPJ em cache

  alt Cache Válido (< 30 dias)

    Cache-->>Worker: Retorna Micro-Contrato e Score

    Worker-->>User: Retorno Instantâneo

  else Cache Inexistente ou Expirado

    Worker->>Base: Consulta dados cadastrais

    Base-->>Worker: JSON Cadastral (Razão Social, Sócios, CNAE)

    Worker->>Search: Executar queries parametrizadas (A, B, C)

    Search-->>Worker: Lista de URLs desduplicadas

    Worker->>Scrape: Scraping seletivo (5-8 links prioritários com semáforo)

    Scrape-->>MRCP: Conteúdos brutos (HTML / Textos)

    MRCP->>MRCP: Parsing determinístico + Atribuição Sócio x Empresa

    MRCP->>MRCP: Cálculo da pontuação (Score A-F)

    MRCP->>DB: Persistência do Dossiê Completo e Fontes

    MRCP->>Cache: Gravação no Cache (TTL 30 dias)

    MRCP-->>User: Retorna Relatório Mínimo

  end



4.1. Taxonomia e Semáforo de Scraping

| Categoria | Padrões de Domínio | Política de Concorrência e Extração |

|---|---|---|

| Processos Judiciais | jusbrasil.com.br, consultas.jus.br, esaj.*.jus.br, pje.*.jus.br | 1 requisição a cada 15s por domínio; fingerprint TLS Chrome 120; extração direta de meta-tags e tabelas processuais. |

| Defesa do Consumidor | reclameaqui.com.br, consumidor.gov.br | 1 requisição a cada 10s por domínio; extração dos blocos numéricos (índice, total, respondidas). |

| Presença Institucional | [linkedin.com/company](https://linkedin.com/company), instagram.com, facebook.com | Validação de existência via cabeçalhos e regex de perfil corporativo. |

| Governamental e Licitações | *.gov.br, doe.*.gov.br | Extração de registros de habilitação, sanções administrativas (CEIS/CNEP) e publicações de concorrência. |

5. Algoritmo de Pontuação Determinística (Score A–F)

O cálculo é estritamente matemático, auditável e imutável a alucinações. O score varia de 0 a 100 pontos:

5.1. Equação de Scoring

> Observação de Regra de Negócio: Processos ou apontamentos associados exclusivamente a sócios com nível de confiança baixo (homônimos sem token corroborante de cidade, CNPJ ou CNAE) nunca deduzem pontos da empresa.

> 

6. Modelo de Dados Unificado (PostgreSQL + JSONB)

erDiagram

  EMPRESA ||--o{ ANALISE : possui

  ANALISE ||--o{ FONTE : coleta

  ANALISE ||--o{ LEAD_ANALISE : gera

  LEAD ||--o{ LEAD_ANALISE : realiza

  LEAD ||--o{ CONSENTIMENTO : registra

  EMPRESA ||--o{ CONTRATO_MRCP : arquiva



  EMPRESA {

    string cnpj PK

    string razao_social

    string nome_fantasia

    string situacao_cadastral

    int idade_anos

    string uf

    jsonb socios

    datetime criado_em

    datetime atualizado_em

  }



  ANALISE {

    uuid id PK

    string cnpj FK

    string nota_global

    int score_numerico

    jsonb micro_contrato_json

    jsonb indicadores_macro

    jsonb discriminacao_score

    datetime criada_em

  }



  FONTE {

    uuid id PK

    uuid analise_id FK

    string url

    string dominio

    string categoria

    string atribuicao

    string confianca_atribuicao

    datetime coletado_em

  }



  LEAD {

    uuid id PK

    string email

    string nome

    string dominio_email

    boolean verificado_optin

    string tipo_lead

    datetime criado_em

  }



  LEAD_ANALISE {

    uuid id PK

    uuid lead_id FK

    uuid analise_id FK

    boolean provavel_decisor

    datetime visualizado_em

  }



  CONSENTIMENTO {

    uuid id PK

    uuid lead_id FK

    string ip_origem

    string versao_politica

    boolean marketing_autorizado

    datetime data_aceite

  }



  CONTRATO_MRCP {

    uuid id PK

    string cnpj FK

    string tipo_documento

    jsonb regras_extraidas

    jsonb clausulas_dqi

    datetime processado_em

  }



7. Interfaces e Exposição (API REST e Model Context Protocol)

O sistema expõe sua inteligência tanto para a interface web quanto para orquestradores de IA corporativos através de ferramentas do Model Context Protocol (MCP) e endpoints REST.

7.1. Endpoints REST (FastAPI)

 * POST /v1/analyze: Recebe { "cnpj": "..." }, aciona o worker assíncrono ou busca no cache e entrega o relatório mínimo.

 * GET /v1/report/{id}: Retorna a estrutura para renderização do relatório mínimo.

 * POST /v1/leads/capture: Recebe e-mail e consentimento, despachando o e-mail transacional de double opt-in.

 * GET /v1/leads/verify/{token}: Confirma o e-mail e libera a visualização do relatório estendido.

 * POST /v1/mrcp/parse-document: Endpoint seguro B2B para envio de arquivos corporativos (.pdf, .docx, .xlsx), retornando o micro-contrato correspondente.

7.2. Contrato de Ferramentas MCP (mrcp-business)

Para que agentes autônomos e IDEs usem o ecossistema sem consumir dados brutos:

{

  "name": "get_company_intelligence",

  "description": "Retorna o micro-contrato estruturado de reputação, situação cadastral e processos de um CNPJ sem injetar dados não estruturados na janela de contexto.",

  "parameters": {

    "type": "object",

    "properties": {

      "cnpj": {

        "type": "string",

        "description": "CNPJ da empresa alvo com ou sem máscara."

      },

      "force_refresh": {

        "type": "boolean",

        "default": false

      }

    },

    "required": ["cnpj"]

  }

}



8. Stack Tecnológica Integrada

| Camada | Tecnologia | Papel Estrutural |

|---|---|---|

| Core Engine / Parsing | Python 3.11+, pypdf, python-docx, openpyxl, selectolax | Dissecação local em binário/CPU de documentos e páginas web. |

| Web Scraping & Evasion | curl_cffi (TLS Chrome 120 impersonation) + Proxies Rotativos | Coleta de dados resiliente contra bloqueios de CDN/WAF. |

| API & Servidor MCP | FastAPI + MCP SDK | Exposição síncrona/assíncrona de endpoints HTTP e JSON-RPC. |

| Fila & Cache | Redis 7 + Celery / ARQ | Fila de coleta com rate limit por domínio e cache de 30 dias por CNPJ. |

| Banco de Dados | PostgreSQL 16 (com suporte a JSONB) | Persistência de grafos corporativos, leads e micro-contratos. |

| Frontend | Next.js (Tailwind CSS, TypeScript) | Interface pública, exibição dos faróis de alerta e funil de conversão. |

| Transacional (E-mails) | Resend / Postmark | Envio ágil de links mágicos e confirmações de consentimento. |

9. Governança, LGPD e FinOps

 * Minimização de Dados e FinOps: Arquivos extensos (balanços, termos contratuais, autos de processos) são processados localmente. Apenas regras matemáticas, resumos de risco e entidades-chave compõem o payload enviado a LLMs ou clientes, assegurando uma redução de até 98% em custos de tokens.

 * Dados Públicos de Pessoas Jurídicas: Dados cadastrais da Receita Federal e andamentos públicos do Judiciário apoiam-se na base legal do Legítimo Interesse e do cumprimento de obrigações de transparência pública.

 * Dados de Pessoas Físicas (Sócios e Leads):

   * Sócios: Não sofrem scoring negativo injustificado por homônimos e não têm dados pessoais desnecessários expostos.

   * Leads: Captura condicionada ao aceite expresso de Política de Privacidade, confirmação via double opt-in e logs de consentimento registrados com carimbo de tempo e IP.

10. Cronograma de Entrega (Roadmap de Execução)

| Etapa | Entregáveis Técnicos | Critério de Aceite / Validação |

|---|---|---|

| Fase 1: Motor Base & API | Integração da API de CNPJ + Core MRCP para extração cadastral e scoring local. | Emissão de Nota A–F cadastral para qualquer CNPJ válido em menos de 1 segundo. |

| Fase 2: Pipeline de Inteligência Web | SearchProvider configurado + StealthScraper com semáforo por domínio para Jusbrasil e Reclame Aqui. | Extração de processos e índice de reclamação com geração do micro-contrato unificado para lote de 30 empresas de teste. |

| Fase 3: Interface Pública & Funil de Leads | Landing page minimalista, modal LGPD, renderização do Relatório Mínimo e fluxo de captura com double opt-in. | Jornada completa operando de ponta a ponta na web pública com persistência no PostgreSQL. |

| Fase 4: Expansão B2B & Suporte MCP | Servidor MCP nativo (mrcp-business) e endpoints para análise e parsing de contratos e planilhas empresariais. | Agentes externos consumindo o contexto da empresa diretamente via MCP sem alucinação de dados. |

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://mrcpbusiness.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/9eeaea84-9686-4ec0-8ed6-c62c18845728).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
