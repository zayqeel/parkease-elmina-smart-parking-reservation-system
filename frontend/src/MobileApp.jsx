import { useEffect, useRef } from 'react';
import source from '../../elminapark_smart_township_mobility.html?raw';
import { connectMobileApp } from './mobile-controller';

// Keep the supplied design as the source of truth; replace its mock script with API controls.
const body = source.match(/<body[^>]*>([\s\S]*?)<\/body>/i)[1].replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
const styles = source.match(/<style>([\s\S]*?)<\/style>/i)[1];
export default function MobileApp() {
  const root = useRef(null);
  useEffect(() => connectMobileApp(root.current), []);
  return <><style>{styles + `
    body { margin:0; user-select:auto; }
    .phone-container { height:100dvh; max-height:none; }
    @media(min-width:640px) { .phone-container { height:calc(100dvh - 40px); } }
    input,select,textarea { font-size:16px !important; min-width:0; }
    button { min-height:44px; }
    nav { padding-bottom:max(6px,env(safe-area-inset-bottom)) !important; }
    .nav-btn { padding-left:3px !important; padding-right:3px !important; flex:1; min-width:0; }
    .nav-btn span { font-size:9px; }
    #mainContainer { padding-bottom:100px; }
    button:disabled { opacity:.5; }
    :focus-visible { outline:3px solid #10b981; outline-offset:2px; }
  `}</style><div ref={root} dangerouslySetInnerHTML={{__html:body}} /></>;
}
