"use strict";(self.webpackChunkapi=self.webpackChunkapi||[]).push([[4457],{11202(A,O,s){s.d(O,{u:()=>E});var t=s(38188);function E(M={}){const{id:g="",...D}=M,{data:P,isLoading:m}=(0,t.c)({id:g,populate:"stages",...D}),[i]=(0,t.d)(),[r]=(0,t.e)(),[o]=(0,t.f)(),{workflows:l,meta:d}=P??{};return{meta:d,workflows:l,isLoading:m,createWorkflow:i,updateWorkflow:r,deleteWorkflow:o}}},26042(A,O,s){s.d(O,{u:()=>m});var t=s(21272),E=s(2129),M=s(51193);const g=M.n.injectEndpoints({endpoints:i=>({getComponents:i.query({query:()=>({url:"/content-manager/components",method:"GET"}),transformResponse:r=>r.data}),getContentTypes:i.query({query:()=>({url:"/content-manager/content-types",method:"GET"}),transformResponse:r=>r.data})}),overrideExisting:!1}),{useGetComponentsQuery:D,useGetContentTypesQuery:P}=g;function m(){const{_unstableFormatAPIError:i}=(0,E.wq)(),r=(0,E.hN)(),o=D(),l=P();t.useEffect(()=>{l.error&&r({type:"warning",message:i(l.error)})},[l.error,i,r]),t.useEffect(()=>{o.error&&r({type:"warning",message:i(o.error)})},[o.error,i,r]);const d=o.isLoading||l.isLoading,h=t.useMemo(()=>(l?.data??[]).filter(c=>c.kind==="collectionType"&&c.isDisplayed),[l?.data]),_=t.useMemo(()=>(l?.data??[]).filter(c=>c.kind!=="collectionType"&&c.isDisplayed),[l?.data]);return{isLoading:d,components:t.useMemo(()=>o?.data??[],[o?.data]),collectionTypes:h,singleTypes:_}}},31460(A,O,s){s.d(O,{B:()=>K,D:()=>B,H:()=>U,R:()=>y});var t=s(92132),E=s(42455),M=s(4198),g=s(55356),D=s(38413),P=s(83997),m=s(30893),i=s(2129),r=s(46270),o=s(9005),l=s(54894),d=s(51193),h=s(25524),_=s(79793);const c=(0,_.Ay)(P.s)`
  svg path {
    fill: ${({theme:a})=>a.colors.neutral600};
  }
`,L=({name:a})=>(0,t.jsxs)(P.s,{background:"primary100",borderStyle:"dashed",borderColor:"primary600",borderWidth:"1px",gap:3,hasRadius:!0,padding:3,shadow:"tableShadow",width:(0,i.a8)(300),children:[(0,t.jsx)(c,{alignItems:"center",background:"neutral200",borderRadius:"50%",height:6,justifyContent:"center",width:6,children:(0,t.jsx)(o.A,{width:`${8/16}rem`})}),(0,t.jsx)(m.o,{fontWeight:"bold",children:a})]}),B=()=>(0,t.jsx)(d.P,{renderItem:a=>{if(a.type===h.D.STAGE)return(0,t.jsx)(L,{name:typeof a.item=="string"?a.item:null})}}),y=({children:a})=>(0,t.jsx)(E.P,{children:(0,t.jsx)(D.g,{tabIndex:-1,children:(0,t.jsx)(M.s,{children:a})})}),K=({href:a})=>{const{formatMessage:T}=(0,l.A)();return(0,t.jsx)(i.N_,{startIcon:(0,t.jsx)(r.A,{}),to:a,children:T({id:"global.back",defaultMessage:"Back"})})},U=({title:a,subtitle:T,navigationAction:W,primaryAction:C})=>(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(i.x7,{name:a}),(0,t.jsx)(g.Q,{navigationAction:W,primaryAction:C,title:a,subtitle:T})]})},40216(A,O,s){s.d(O,{S:()=>r});var t=s(92132),E=s(79793),M=s(94061),g=s(48653),D=s(83997),P=s(30893);const m=(0,E.Ay)(M.a)`
  height: ${24/16}rem;
  width: ${24/16}rem;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;

  svg {
    height: ${10/16}rem;
    width: ${10/16}rem;
  }

  svg path {
    fill: ${({theme:o})=>o.colors.primary600};
  }
`,i=(0,E.Ay)(M.a)`
  border-radius: 0 0 ${({theme:o})=>o.borderRadius} ${({theme:o})=>o.borderRadius};
  display: block;
  width: 100%;
  border: none;
`,r=({children:o,icon:l,...d})=>(0,t.jsxs)("div",{children:[(0,t.jsx)(g.c,{}),(0,t.jsx)(i,{as:"button",background:"primary100",padding:5,...d,children:(0,t.jsxs)(D.s,{children:[(0,t.jsx)(m,{"aria-hidden":!0,background:"primary200",children:l}),(0,t.jsx)(M.a,{paddingLeft:3,children:(0,t.jsx)(P.o,{variant:"pi",fontWeight:"bold",textColor:"primary600",children:o})})]})})]})},64457(A,O,s){s.d(O,{ProtectedReviewWorkflowsPage:()=>V});var t=s(92132),E=s(21272),M=s(88353),g=s(43064),D=s(83997),P=s(35513),m=s(25641),i=s(26127),r=s(90361),o=s(33363),l=s(40216),d=s(30893),h=s(98765),_=s(2129),c=s(41909),L=s(5194),B=s(50612),y=s(54894),K=s(17703),U=s(79793),a=s(51193),T=s(26042),W=s(31460),C=s(45084),H=s(25524),Q=s(11202),ls=s(15126),Es=s(63299),ds=s(67014),Ms=s(59080),Ds=s(79275),Ps=s(14718),Os=s(82437),gs=s(61535),ms=s(5790),cs=s(12083),vs=s(35223),fs=s(5409),hs=s(74930),Ts=s(2600),Cs=s(48940),As=s(41286),Ls=s(56336),Ws=s(13426),Rs=s(84624),Is=s(77965),Bs=s(54257),ys=s(71210),Ks=s(51187),Us=s(39404),js=s(58692),xs=s(501),us=s(57646),ps=s(23120),ws=s(44414),Ss=s(25962),$s=s(14664),Ns=s(42588),Fs=s(90325),zs=s(62785),Gs=s(87443),Hs=s(41032),Qs=s(22957),Xs=s(93179),Ys=s(73055),Vs=s(15747),Js=s(85306),Zs=s(26509),ks=s(32058),bs=s(81185),qs=s(82261),st=s(38188);const X=(0,U.Ay)(_.N_)`
  align-items: center;
  height: ${(0,_.a8)(32)};
  display: flex;
  justify-content: center;
  padding: ${({theme:e})=>`${e.spaces[2]}}`};
  width: ${(0,_.a8)(32)};

  svg {
    height: ${(0,_.a8)(12)};
    width: ${(0,_.a8)(12)};

    path {
      fill: ${({theme:e})=>e.colors.neutral500};
    }
  }

  &:hover,
  &:focus {
    svg {
      path {
        fill: ${({theme:e})=>e.colors.neutral800};
      }
    }
  }
`,Y=()=>{const{formatMessage:e}=(0,y.A)(),{push:R}=(0,K.W6)(),{trackUsage:w}=(0,_.z1)(),[j,x]=E.useState(null),[J,I]=E.useState(!1),{collectionTypes:Z,singleTypes:k,isLoading:b}=(0,T.u)(),{meta:v,workflows:S,isLoading:u,deleteWorkflow:q}=(0,Q.u)(),[ss,$]=E.useState(!1),{_unstableFormatAPIError:ts}=(0,_.wq)(),p=(0,_.hN)(),{getFeature:os,isLoading:N}=(0,a.m)(),es=(0,a.j)(n=>n.admin_app.permissions.settings?.["review-workflows"]),{allowedActions:{canCreate:F,canDelete:ns}}=(0,_.ec)(es),f=os("review-workflows")?.[H.C],_s=n=>[...Z,...k].find(G=>G.uid===n)?.info.displayName,as=n=>{x(n)},is=()=>{x(null)},rs=async()=>{if(j)try{$(!0);const n=await q({id:j});if("error"in n){p({type:"warning",message:ts(n.error)});return}x(null),p({type:"success",message:{id:"notification.success.deleted",defaultMessage:"Deleted"}})}catch{p({type:"warning",message:{id:"notification.error.unexpected",defaultMessage:"An error occurred"}})}finally{$(!1)}};return E.useEffect(()=>{!u&&!N&&f&&v&&v?.workflowCount>parseInt(f,10)&&I(!0)},[N,u,v,v?.workflowCount,f]),(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(W.H,{primaryAction:F&&(0,t.jsx)(_.z9,{startIcon:(0,t.jsx)(L.A,{}),size:"S",to:"/settings/review-workflows/create",onClick:n=>{f&&v&&v?.workflowCount>=parseInt(f,10)?(n.preventDefault(),I(!0)):w("willCreateWorkflow")},children:e({id:"Settings.review-workflows.list.page.create",defaultMessage:"Create new workflow"})}),subtitle:e({id:"Settings.review-workflows.list.page.subtitle",defaultMessage:"Manage your content review process"}),title:e({id:"Settings.review-workflows.list.page.title",defaultMessage:"Review Workflows"})}),(0,t.jsxs)(W.R,{children:[u||b?(0,t.jsx)(D.s,{justifyContent:"center",children:(0,t.jsx)(g.a,{children:e({id:"Settings.review-workflows.page.list.isLoading",defaultMessage:"Workflows are loading"})})}):(0,t.jsxs)(P.X,{colCount:3,footer:F&&(0,t.jsx)(l.S,{icon:(0,t.jsx)(L.A,{}),onClick:()=>{f&&v&&v?.workflowCount>=parseInt(f,10)?I(!0):(R("/settings/review-workflows/create"),w("willCreateWorkflow"))},children:e({id:"Settings.review-workflows.list.page.create",defaultMessage:"Create new workflow"})}),rowCount:1,children:[(0,t.jsx)(i.d,{children:(0,t.jsxs)(r.Tr,{children:[(0,t.jsx)(o.Th,{children:(0,t.jsx)(d.o,{variant:"sigma",children:e({id:"Settings.review-workflows.list.page.list.column.name.title",defaultMessage:"Name"})})}),(0,t.jsx)(o.Th,{children:(0,t.jsx)(d.o,{variant:"sigma",children:e({id:"Settings.review-workflows.list.page.list.column.stages.title",defaultMessage:"Stages"})})}),(0,t.jsx)(o.Th,{children:(0,t.jsx)(d.o,{variant:"sigma",children:e({id:"Settings.review-workflows.list.page.list.column.contentTypes.title",defaultMessage:"Content Types"})})}),(0,t.jsx)(o.Th,{children:(0,t.jsx)(h.s,{children:e({id:"Settings.review-workflows.list.page.list.column.actions.title",defaultMessage:"Actions"})})})]})}),(0,t.jsx)(m.N,{children:S?.map(n=>(0,E.createElement)(r.Tr,{...(0,_.qM)({fn(z){z.target.nodeName!=="BUTTON"&&R(`/settings/review-workflows/${n.id}`)}}),key:`workflow-${n.id}`},(0,t.jsx)(o.Td,{width:(0,_.a8)(250),children:(0,t.jsx)(d.o,{textColor:"neutral800",fontWeight:"bold",ellipsis:!0,children:n.name})}),(0,t.jsx)(o.Td,{children:(0,t.jsx)(d.o,{textColor:"neutral800",children:n.stages.length})}),(0,t.jsx)(o.Td,{children:(0,t.jsx)(d.o,{textColor:"neutral800",children:(n?.contentTypes??[]).map(_s).join(", ")})}),(0,t.jsx)(o.Td,{children:(0,t.jsxs)(D.s,{alignItems:"center",justifyContent:"end",children:[(0,t.jsx)(X,{to:`/settings/review-workflows/${n.id}`,"aria-label":e({id:"Settings.review-workflows.list.page.list.column.actions.edit.label",defaultMessage:"Edit {name}"},{name:n.name}),children:(0,t.jsx)(c.A,{})}),S.length>1&&ns&&(0,t.jsx)(M.K,{"aria-label":e({id:"Settings.review-workflows.list.page.list.column.actions.delete.label",defaultMessage:"Delete {name}"},{name:"Default workflow"}),icon:(0,t.jsx)(B.A,{}),noBorder:!0,onClick:()=>{as(String(n.id))}})]})})))})]}),(0,t.jsx)(_.TM,{bodyText:{id:"Settings.review-workflows.list.page.delete.confirm.body",defaultMessage:"If you remove this worfklow, all stage-related information will be removed for this content-type. Are you sure you want to remove it?"},isConfirmButtonLoading:ss,isOpen:!!j,onToggleDialog:is,onConfirm:rs}),(0,t.jsxs)(C.L.Root,{isOpen:J,onClose:()=>I(!1),children:[(0,t.jsx)(C.L.Title,{children:e({id:"Settings.review-workflows.list.page.workflows.limit.title",defaultMessage:"You\u2019ve reached the limit of workflows in your plan"})}),(0,t.jsx)(C.L.Body,{children:e({id:"Settings.review-workflows.list.page.workflows.limit.body",defaultMessage:"Delete a workflow or contact Sales to enable more workflows."})})]})]})]})},V=()=>{const e=(0,a.j)(R=>R.admin_app.permissions.settings?.["review-workflows"]?.main);return(0,t.jsx)(_.kz,{permissions:e,children:(0,t.jsx)(Y,{})})}}}]);
