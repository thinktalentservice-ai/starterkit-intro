import{n as e}from"./rolldown-runtime-sJBDdmOt.js";import{t}from"./jsx-runtime-MKhVqBIO.js";import{a as n,i as r,n as i,t as a}from"./fixtures-D_YXI1kD.js";import{n as o,t as s}from"./IntroProvider-gOa2-g45.js";var c,l,u,d,f,p,m,h;function g(){return(g=e((()=>{o(),r(),c=t(),{fn:l}=__STORYBOOK_MODULE_TEST__,u={title:`Components/IntroProvider`,component:s,parameters:{docs:{description:{component:"Loads the intro JSON for the current `pathname` from `baseUrl`, decides whether to auto-start, and renders the tour. It knows nothing about routers: pass the pathname in. These stories inject the document through `fetchIntro` so nothing is fetched; press the **?** button in the header to start the tour."}}},args:{pathname:`/`,baseUrl:`/intro`,autoStart:!1,autoStartDelay:700,storageKey:`sb-intro:provider`,fetchIntro:n(i),onEvent:l()},argTypes:{children:{control:!1},fetchIntro:{control:!1},labels:{control:`object`}},render:e=>(0,c.jsx)(s,{...e,children:(0,c.jsx)(a,{})})},d={},f={args:{autoStart:!0,storageKey:`sb-intro:autostart`},beforeEach:()=>{try{localStorage.removeItem(`sb-intro:autostart`)}catch{}}},p={args:{storageKey:`sb-intro:labels`,labels:{next:`Weiter`,back:`Zurück`,done:`Fertig`,skip:`Überspringen`,stepOf:`Schritt {n} von {total}`,close:`Schließen`}}},m={args:{pathname:`/no-intro-here`,storageKey:`sb-intro:none`,fetchIntro:n(null)}},d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{}`,...d.parameters?.docs?.source},description:{story:`Start the tour from the **?** button. Events appear in the Actions panel.`,...d.parameters?.docs?.description}}},f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  args: {
    autoStart: true,
    storageKey: "sb-intro:autostart"
  },
  beforeEach: () => {
    try {
      localStorage.removeItem("sb-intro:autostart");
    } catch {
      /* storage blocked: the story still renders, it just may not auto-start */
    }
  }
}`,...f.parameters?.docs?.source},description:{story:`The first visit to a revision starts the tour on its own after\r
\`autoStartDelay\`. The seen-state is cleared before each render here, so it\r
auto-starts every time you open this story.`,...f.parameters?.docs?.description}}},p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    storageKey: "sb-intro:labels",
    labels: {
      next: "Weiter",
      back: "Zurück",
      done: "Fertig",
      skip: "Überspringen",
      stepOf: "Schritt {n} von {total}",
      close: "Schließen"
    }
  }
}`,...p.parameters?.docs?.source},description:{story:`Every label is replaceable, for localisation or house style.`,...p.parameters?.docs?.description}}},m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    pathname: "/no-intro-here",
    storageKey: "sb-intro:none",
    fetchIntro: memoryFetch(null)
  }
}`,...m.parameters?.docs?.source},description:{story:`A page with no JSON file: the provider renders nothing and the help button is disabled.`,...m.parameters?.docs?.description}}},h=[`Default`,`AutoStart`,`CustomLabels`,`NoIntroForPage`]})))()}g();export{f as AutoStart,p as CustomLabels,d as Default,m as NoIntroForPage,h as __namedExportsOrder,u as default};