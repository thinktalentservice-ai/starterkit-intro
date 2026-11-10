import{n as e}from"./rolldown-runtime-sJBDdmOt.js";import{D as t}from"./iframe-vQqB_8T7.js";import{t as n}from"./jsx-runtime-MKhVqBIO.js";import{i as r,o as i,r as a,s as o,t as s}from"./fixtures-D_YXI1kD.js";function c(e){let[t,n]=(0,l.useState)(!1),[r,a]=(0,l.useState)(null);return(0,u.jsxs)(u.Fragment,{children:[(0,u.jsx)(s,{tools:!1,actions:(0,u.jsxs)(u.Fragment,{children:[r&&(0,u.jsxs)(`p`,{className:`status`,children:[`Last close: `,r]}),(0,u.jsx)(`button`,{type:`button`,className:`launch`,onClick:()=>n(!0),children:`Start tour`})]})}),t&&(0,u.jsx)(i,{...e,onClose:t=>{e.onClose(t),a(t),n(!1)}})]})}var l,u,d,f,p,m,h,g,_,v;function y(){return(y=e((()=>{l=t(),o(),r(),u=n(),{fn:d}=__STORYBOOK_MODULE_TEST__,f={title:`Components/IntroTour`,component:i,parameters:{docs:{description:{component:"The tour engine on its own: a scrim, a spotlight on the target and a positioned popover. Use it directly only when you manage loading and seen-state yourself; otherwise use `IntroProvider`. Press **Start tour** in each preview."}}},args:{steps:a,onClose:d(),onEvent:d()},render:e=>(0,u.jsx)(c,{...e})},p={},m={args:{steps:[{id:`hello`,title:`Hello`,body:`No target, so the popover sits in the middle of the viewport.`},{id:`bye`,title:`That's it`,body:`Two centred steps make a lightweight announcement.`}]}},h=e=>({id:`place-${e}`,target:`[data-intro="features"]`,title:`placement: "${e}"`,body:`The preferred side. If it does not fit, the engine flips and clamps inside the viewport.`,placement:e}),g={args:{steps:[`top`,`right`,`bottom`,`left`,`auto`].map(h)}},_={args:{steps:[{id:`ghost`,target:`[data-intro="nope"]`,title:`Ghost`,body:`Never shown.`},{id:`hero`,target:`[data-intro="hero"]`,title:`The hero`,body:`The missing step before this one was skipped.`}]}},p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{}`,...p.parameters?.docs?.source}}},m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    steps: [{
      id: "hello",
      title: "Hello",
      body: "No target, so the popover sits in the middle of the viewport."
    }, {
      id: "bye",
      title: "That's it",
      body: "Two centred steps make a lightweight announcement."
    }]
  }
}`,...m.parameters?.docs?.source},description:{story:"A step without `target` is centred with no spotlight.",...m.parameters?.docs?.description}}},g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  args: {
    steps: (["top", "right", "bottom", "left", "auto"] as const).map(placement)
  }
}`,...g.parameters?.docs?.source},description:{story:"Each step points at the same section with a different preferred `placement`.",...g.parameters?.docs?.description}}},_.parameters={..._.parameters,docs:{..._.parameters?.docs,source:{originalSource:`{
  args: {
    steps: [{
      id: "ghost",
      target: '[data-intro="nope"]',
      title: "Ghost",
      body: "Never shown."
    }, {
      id: "hero",
      target: '[data-intro="hero"]',
      title: "The hero",
      body: "The missing step before this one was skipped."
    }]
  }
}`,..._.parameters?.docs?.source},description:{story:'A required step whose target is missing is skipped with a console warning\r\nand a `missing-target` event; if nothing can be shown the tour closes with "empty".',..._.parameters?.docs?.description}}},v=[`Default`,`CentredOnly`,`Placements`,`MissingTargets`]})))()}y();export{m as CentredOnly,p as Default,_ as MissingTargets,g as Placements,v as __namedExportsOrder,f as default};