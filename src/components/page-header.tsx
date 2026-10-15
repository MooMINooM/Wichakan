import type {ReactNode} from 'react';
import {SchoolScene} from '@/components/academic-visuals';

type Props={title:string;context?:ReactNode;actions?:ReactNode};
/** One heading size and hero height for every workspace route. */
export default function PageHeader({title,context,actions}:Props){
 return <><header className="ui-header">
  <div className="ui-header-copy"><h1>{title}</h1>{context&&<p className="ui-header-context">{context}</p>}</div>
  <SchoolScene/>
 </header>{actions&&<div className="ui-page-actions">{actions}</div>}</>;
}
