import type {ReactNode} from 'react';

type Props={title:string;context?:ReactNode;actions?:ReactNode};
/** One heading size and spacing for every workspace route. */
export default function PageHeader({title,context,actions}:Props){
 return <><header className="ui-header">
  <div className="ui-header-copy"><span className="ui-header-eyebrow">WICHAKAN</span><h1>{title}</h1>{context&&<p className="ui-header-context">{context}</p>}</div>
 </header>{actions&&<div className="ui-page-actions">{actions}</div>}</>;
}
