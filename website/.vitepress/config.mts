import { defineConfig } from 'vitepress'
import { createRequire } from 'module'
import llmstxt from 'vitepress-plugin-llms'

const require = createRequire(import.meta.url)
const pkg = require('../../package.json')

export default defineConfig({
  title: 'openclaw-amem',
  description: 'A-MEM agentic memory backend for OpenClaw — dynamic memory networks, automatic link generation, memory evolution, and hybrid retrieval.',
  base: '/',

  head: [
    ['link', { rel: 'icon', href: '/favicon.webp', type: 'image/webp' }],
  ],

  themeConfig: {
    logo: '/logo.webp',
    siteTitle: 'openclaw-amem',

    nav: [
      { text: 'Guide', link: '/guide/introduction' },
      { text: 'Reference', link: '/reference/configuration' },
      { text: `v${pkg.version}`, link: 'https://github.com/heichaowo/openclaw-amem/releases' },
    ],

    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: 'Introduction', link: '/guide/introduction' },
          { text: 'Installation', link: '/guide/installation' },
          { text: 'Quick Start', link: '/guide/quick-start' },
        ],
      },
      {
        text: 'Architecture',
        items: [
          { text: 'How It Works', link: '/guide/how-it-works' },
          { text: 'A-MEM vs Traditional RAG', link: '/guide/comparison' },
          { text: 'Evolution & Quality', link: '/guide/evolution' },
          { text: 'Agent Isolation', link: '/guide/agent-isolation' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'Configuration', link: '/reference/configuration' },
          { text: 'Tools', link: '/reference/tools' },
          { text: 'Smoke Test Results', link: '/reference/smoketest' },
        ],
      },
      {
        text: 'Development',
        items: [
          { text: 'Contributing', link: '/guide/contributing' },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/heichaowo/openclaw-amem' },
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Based on <a href="https://arxiv.org/abs/2502.12110">A-MEM</a> (NeurIPS 2025)',
    },

    editLink: {
      pattern: 'https://github.com/heichaowo/openclaw-amem/edit/main/website/:path',
      text: 'Edit this page on GitHub',
    },

    search: {
      provider: 'local',
    },
  },

  markdown: {
    theme: {
      light: 'github-light',
      dark: 'github-dark',
    },
  },

  vite: {
    plugins: [llmstxt()],
  },
})
