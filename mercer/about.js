(()=>{"use strict";const o=window.Mercer=window.Mercer||{},c=document,i=(t,n=c)=>n.querySelector(t),p=t=>String(t).replace(/[&<>"]/g,n=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[n]),d=(t,n)=>{try{o.feel?.play?.(t,n)}catch{}},b='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',e=i("#about-panel"),l=i("#about-tma");if(!e)return;let u=null;function y(){let t="";try{t=String(o.BOOKING_URL??o.bookingUrl??"")}catch{t=""}if(!t)try{t=String(i("#hv-call")?.dataset?.href??"")}catch{t=""}const n=/cal\.com\/([a-z]+)-([a-z]+)/i.exec(t);if(!n)return"Adam Attia";const a=s=>s.charAt(0).toUpperCase()+s.slice(1);return`${a(n[1])} ${a(n[2])}`}const m=["One system for the whole enquiry journey: capture, reply, booking and reminders, follow-up, outcomes and reporting.","It is installed in your own tools where they allow it, and maintained after it goes live.","The measurements under it, so you can tell whether it worked."];function w(){const t=y(),n=o.state?.route!=="owner"&&o.state?.route!=="starter",a=n?"Return to my check":"Return to my plan";return`
  <div class="help-head">
    <h2 id="about-title" tabindex="-1"><span class="about-mark"><svg class="logo" aria-hidden="true"><use href="#tma-mark"/></svg>About TMA</span></h2>
    <button type="button" class="help-close" aria-label="${a}">${b}</button>
  </div>
  <div class="about-body">
    <section>
      <h3>What TMA is for</h3>
      <p class="about-what">${p(n?"TMA installs and maintains one system for how a business handles its enquiries. Mercer is its free check of how enquiries turn into customers: it shows where an enquiry is lost and what would change. When you want help putting it into practice, TMA can work with you on that system.":"TMA helps people turn their ambitions into businesses and systems that work. Mercer is its free check of how enquiries turn into customers: it shows where an enquiry is lost and what would change. When you want help putting it into practice, TMA can work with you on the systems and routes to customers it needs.")}</p>
      <p class="small">TMA is The Mission Automation.</p>
    </section>
    <section>
      <h3>Who runs it</h3>
      <p>TMA is run by ${p(t)}, who takes the calls booked from a ${n?"diagnostic":"plan"}. Mercer is TMA's own tool, given away so that a first conversation starts from a diagnostic you already have rather than a blank page.</p>
    </section>
    <section>
      <h3>What TMA can help implement</h3>
      <ul>${m.map(h=>`<li>${p(h)}</li>`).join("")}</ul>
      <p>Book a call sits at the end of your diagnostic. It is a 20-minute call, and it is open to everyone.</p>
    </section>
  </div>
  <div class="about-foot">
    <button type="button" class="glass glass-on" id="about-back">${a}</button>
    <a class="about-link" href="https://themissionautomation.com" target="_blank" rel="noopener">themissionautomation.com, in a new tab</a>
  </div>`}function v(){return[...e.querySelectorAll('button:not([disabled]), a[href], [tabindex="0"]')].filter(t=>t.offsetParent!==null)}function f(){if(e.open)return!0;u=c.activeElement&&c.activeElement!==c.body?c.activeElement:l,e.innerHTML=w(),i(".help-close",e)?.addEventListener("click",()=>r()),i("#about-back",e)?.addEventListener("click",()=>r());try{o.overlay?.open?.("about",{el:e,opener:u,close:r})}catch{}try{typeof e.showModal=="function"?e.showModal():e.setAttribute("open","")}catch{e.setAttribute("open","")}return l?.setAttribute("aria-expanded","true"),d("open"),i("#about-title",e)?.focus({preventScroll:!0}),!0}function r(){if(e.open){try{o.overlay?.close?.("about",{silent:!0})}catch{}try{typeof e.close=="function"?e.close():e.removeAttribute("open")}catch{e.removeAttribute("open")}e.hasAttribute("open")&&e.removeAttribute("open")}}e.addEventListener("close",()=>{l?.setAttribute("aria-expanded","false"),e.innerHTML="";try{o.overlay?.close?.("about",{silent:!0})}catch{}d("close");const t=u&&u.isConnected?u:l;try{t?.focus?.({preventScroll:!0})}catch{}u=null}),e.addEventListener("click",t=>{t.target===e&&r()}),e.addEventListener("keydown",t=>{if(t.stopPropagation(),t.key==="Escape"){t.preventDefault(),r();return}if(t.key!=="Tab")return;const n=v();if(!n.length){t.preventDefault();return}const a=n[0],s=n[n.length-1],h=c.activeElement;t.shiftKey&&(h===a||!e.contains(h)||h===i("#about-title",e))?(t.preventDefault(),s.focus()):!t.shiftKey&&h===s&&(t.preventDefault(),a.focus())}),l?.setAttribute("aria-expanded","false"),l?.addEventListener("click",()=>e.open?r():f()),o.about={open:f,close:r,isOpen:()=>!!e.open}})();
