import{n as e}from"./rolldown-runtime-sJBDdmOt.js";import{D as t}from"./iframe-vQqB_8T7.js";import{t as n}from"./jsx-runtime-MKhVqBIO.js";import{a as r,c as i,d as a,i as o,l as s,n as c,t as l,u}from"./fixtures-D_YXI1kD.js";import{n as d,t as f}from"./IntroProvider-gOa2-g45.js";function p(){return(0,m.useLayoutEffect)(()=>{let e=document.documentElement;return e.classList.add(`sb-light-theme`),()=>e.classList.remove(`sb-light-theme`)},[]),(0,h.jsx)(f,{pathname:`/`,baseUrl:`/intro`,autoStart:!1,storageKey:`sb-intro:light`,fetchIntro:r(c),children:(0,h.jsx)(l,{})})}var m,h,g,_,v,y,b,x,S;function C(){return(C=e((()=>{m=t(),a(),s(),d(),o(),h=n(),g=(e,t=!0)=>function(n){return(0,h.jsx)(f,{pathname:`/`,baseUrl:`/intro`,autoStart:!1,storageKey:e,fetchIntro:r(t?c:null),children:(0,h.jsx)(`div`,{className:`sb-demo`,style:{minHeight:0,padding:24},children:(0,h.jsx)(`div`,{className:`tools`,style:{display:`inline-flex`},children:(0,h.jsx)(n,{})})})})},_={title:`Components/Controls`,parameters:{docs:{story:{iframeHeight:140}}}},v={name:`IntroHelpButton`,render:e=>(0,h.jsx)(i,{...e}),args:{label:`Start page intro`},decorators:[g(`sb-intro:help`)],parameters:{docs:{description:{story:`Starts the tour for the current page. Disabled when the page has no intro.`}}}},y={name:`IntroHelpButton (no intro)`,render:e=>(0,h.jsx)(i,{...e}),decorators:[g(`sb-intro:help-off`,!1)]},b={name:`IntroAutoStartSwitch`,render:e=>(0,h.jsx)(u,{...e}),args:{label:`Show intro on new pages`},decorators:[g(`sb-intro:switch`)],parameters:{docs:{description:{story:"Turns auto-start off for every page. The choice is stored under the provider's `storageKey`."}}}},x={name:`Recipe: light host theme`,parameters:{docs:{story:{iframeHeight:560},description:{story:"Define the host tokens (`--surface-elevated`, `--fg1`, `--primary-solid`, …) and the tour follows them. No package-specific selectors needed."}}},render:()=>(0,h.jsx)(p,{})},v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  name: "IntroHelpButton",
  render: args => <IntroHelpButton {...args} />,
  args: {
    label: "Start page intro"
  },
  decorators: [withProvider("sb-intro:help")],
  parameters: {
    docs: {
      description: {
        story: "Starts the tour for the current page. Disabled when the page has no intro."
      }
    }
  }
}`,...v.parameters?.docs?.source}}},y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  name: "IntroHelpButton (no intro)",
  render: args => <IntroHelpButton {...args} />,
  decorators: [withProvider("sb-intro:help-off", false)]
}`,...y.parameters?.docs?.source}}},b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  name: "IntroAutoStartSwitch",
  render: args => <IntroAutoStartSwitch {...args} />,
  args: {
    label: "Show intro on new pages"
  },
  decorators: [withProvider("sb-intro:switch")],
  parameters: {
    docs: {
      description: {
        story: "Turns auto-start off for every page. The choice is stored under the provider's \`storageKey\`."
      }
    }
  }
}`,...b.parameters?.docs?.source}}},x.parameters={...x.parameters,docs:{...x.parameters?.docs,source:{originalSource:`{
  name: "Recipe: light host theme",
  parameters: {
    docs: {
      story: {
        iframeHeight: 560
      },
      description: {
        story: "Define the host tokens (\`--surface-elevated\`, \`--fg1\`, \`--primary-solid\`, …) and the tour follows them. " + "No package-specific selectors needed."
      }
    }
  },
  render: () => <LightThemePage />
}`,...x.parameters?.docs?.source},description:{story:`Not a component story: the full page with a light host theme.`,...x.parameters?.docs?.description}}},S=[`HelpButton`,`HelpButtonDisabled`,`AutoStartSwitch`,`LightHostTheme`]})))()}C();export{b as AutoStartSwitch,v as HelpButton,y as HelpButtonDisabled,x as LightHostTheme,S as __namedExportsOrder,_ as default};