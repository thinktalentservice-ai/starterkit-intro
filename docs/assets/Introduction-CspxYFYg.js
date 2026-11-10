import{n as e}from"./rolldown-runtime-sJBDdmOt.js";import{_ as t,a as n,o as r,v as i}from"./blocks-BZGL3B1J.js";import{t as a}from"./jsx-runtime-MKhVqBIO.js";function o(e){let t={a:`a`,code:`code`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,pre:`pre`,strong:`strong`,ul:`ul`,...i(),...e.components};return(0,c.jsxs)(c.Fragment,{children:[(0,c.jsx)(n,{title:`Introduction`}),`
`,(0,c.jsx)(t.h1,{id:`devopsnextstarterkit-intro`,children:`@devopsnext/starterkit-intro`}),`
`,(0,c.jsx)(t.p,{children:`A guided intro ("product tour") for any React app, driven by one small JSON file
per page. Router-agnostic, no runtime dependencies, its own positioning engine.`}),`
`,(0,c.jsxs)(t.ul,{children:[`
`,(0,c.jsxs)(t.li,{children:[(0,c.jsx)(t.strong,{children:`JSON, not code.`}),` `,(0,c.jsx)(t.code,{children:`public/intro/design/badge.json`}),` is the intro for `,(0,c.jsx)(t.code,{children:`/design/badge`}),`.`]}),`
`,(0,c.jsxs)(t.li,{children:[(0,c.jsx)(t.strong,{children:`Per page, remembered.`}),` Each page tours itself once per `,(0,c.jsx)(t.code,{children:`revision`}),`. Bump it and everyone sees it again.`]}),`
`,(0,c.jsxs)(t.li,{children:[(0,c.jsx)(t.strong,{children:`A CLI that never overwrites a person.`}),` `,(0,c.jsx)(t.code,{children:`starterkit-intro capture`}),` scaffolds files from `,(0,c.jsx)(t.code,{children:`data-intro="…"`}),` markers.`]}),`
`,(0,c.jsx)(t.li,{children:(0,c.jsxs)(t.strong,{children:[`Peers: `,(0,c.jsx)(t.code,{children:`react`}),` and `,(0,c.jsx)(t.code,{children:`react-dom`}),` (>=18) only.`]})}),`
`]}),`
`,(0,c.jsx)(t.h2,{id:`install`,children:`Install`}),`
`,(0,c.jsx)(t.pre,{children:(0,c.jsx)(t.code,{className:`language-bash`,children:`pnpm add --save-exact @devopsnext/starterkit-intro
`})}),`
`,(0,c.jsx)(t.pre,{children:(0,c.jsx)(t.code,{className:`language-ts`,children:`import "@devopsnext/starterkit-intro/styles.css";
`})}),`
`,(0,c.jsx)(t.h2,{id:`use`,children:`Use`}),`
`,(0,c.jsx)(t.pre,{children:(0,c.jsx)(t.code,{className:`language-tsx`,children:`import { IntroProvider, IntroHelpButton } from "@devopsnext/starterkit-intro";

<IntroProvider pathname={pathname} baseUrl="/intro">
  <IntroHelpButton />
  <App />
</IntroProvider>
`})}),`
`,(0,c.jsx)(t.p,{children:`Mark the elements a tour should point at:`}),`
`,(0,c.jsx)(t.pre,{children:(0,c.jsx)(t.code,{className:`language-html`,children:`<section data-intro="hero">…</section>
`})}),`
`,(0,c.jsxs)(t.p,{children:[`and describe the tour in `,(0,c.jsx)(t.code,{children:`public/intro/index.json`}),` (for the route `,(0,c.jsx)(t.code,{children:`/`}),`):`]}),`
`,(0,c.jsx)(t.pre,{children:(0,c.jsx)(t.code,{className:`language-json`,children:`{
  "schema": 1,
  "route": "/",
  "revision": 1,
  "steps": [
    { "id": "welcome", "title": "Welcome", "body": "A centred step: no target." },
    { "id": "hero", "target": "[data-intro=\\"hero\\"]", "title": "The hero", "body": "Points at any CSS selector.", "placement": "bottom" }
  ]
}
`})}),`
`,(0,c.jsx)(t.h2,{id:`in-this-storybook`,children:`In this Storybook`}),`
`,(0,c.jsxs)(t.ul,{children:[`
`,(0,c.jsxs)(t.li,{children:[(0,c.jsx)(t.strong,{children:`Components / IntroProvider`}),` — the whole thing on a demo page: auto-start, custom labels, a page with no intro.`]}),`
`,(0,c.jsxs)(t.li,{children:[(0,c.jsx)(t.strong,{children:`Components / IntroTour`}),` — the bare engine: placements, centred steps, missing targets.`]}),`
`,(0,c.jsxs)(t.li,{children:[(0,c.jsx)(t.strong,{children:`Components / Controls`}),` — the help button, the auto-start switch, and theming with host tokens.`]}),`
`]}),`
`,(0,c.jsxs)(t.p,{children:[`Source and full README: `,(0,c.jsx)(t.a,{href:`https://github.com/thinktalentservice-ai/starterkit-intro`,rel:`nofollow`,children:`github.com/thinktalentservice-ai/starterkit-intro`}),`.`]})]})}function s(e={}){let{wrapper:t}={...i(),...e.components};return t?(0,c.jsx)(t,{...e,children:(0,c.jsx)(o,{...e})}):o(e)}var c;function l(){return(l=e((()=>{c=a(),t(),r()})))()}l();export{s as default};