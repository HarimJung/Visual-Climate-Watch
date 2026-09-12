import {NextResponse,type NextRequest} from 'next/server';

// One name. The apex is attached to the worker only so it can hand the reader
// to www, which is what every canonical on the site already says. The assets
// layer's _redirects cannot do this: it matches paths, never hosts.
//
// The destination is spelled out rather than derived from the request: under
// wrangler dev the incoming host and nextUrl disagree, and there is exactly one
// place to send anyone anyway.
export function proxy(req:NextRequest){
 if(req.nextUrl.hostname!=='visualclimate.org')return;
 return NextResponse.redirect(`https://www.visualclimate.org${req.nextUrl.pathname}${req.nextUrl.search}`,301);
}
