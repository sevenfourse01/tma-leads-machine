(()=>{"use strict";const o=window.Mercer=window.Mercer||{},i=document,a=(t,n=i)=>n.querySelector(t),p=t=>String(t).replace(/[&<>"]/g,n=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[n]),d=(t,n)=>{try{o.feel?.play?.(t,n)}catch{}},f='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',e=a("#about-panel"),l=a("#about-tma");if(!e)return;let c=null;function y(){let t="";try{t=String(o.BOOKING_URL??o.bookingUrl??"")}catch{t=""}if(!t)try{t=String(a("#hv-call")?.dataset?.href??"")}catch{t=""}const n=/cal\.com\/([a-z]+)-([a-z]+)/i.exec(t);if(!n)return"Adam Attia";const u=r=>r.charAt(0).toUpperCase()+r.slice(1);return`${u(n[1])} ${u(n[2])}`}const m=["The systems behind the plan: the tools, the automation and the handovers it depends on.","The routes to customers it names, set up and running rather than listed.","The measurements under each action, so you can tell whether it worked."];function v(){const t=y();return`
  <div class="help-head">
    <h2 id="about-title" tabindex="-1"><span class="about-mark"><svg class="logo" aria-hidden="true"><use href="#tma-mark"/></svg>About TMA</span></h2>
    <button type="button" class="help-close" aria-label="Return to my plan">${f}</button>
  </div>
  <div class="about-body">
    <section>
      <h3>What TMA is for</h3>
      <p class="about-what">TMA helps people turn their ambitions into businesses and systems that work. Mercer helps you see a direction and build a plan around your strengths. When you want help putting it into practice, TMA can work with you on the systems and routes to customers it needs.</p>
      <p class="small">TMA is The Mission Automation.</p>
    </section>
    <section>
      <h3>Who runs it</h3>
      <p>TMA is run by ${p(t)}, who takes the calls booked from a plan. Mercer is TMA's own tool, given away so that a first conversation starts from a plan you already have rather than a blank page.</p>
    </section>
    <section>
      <h3>What TMA can help implement</h3>
      <ul>${m.map(n=>`<li>${p(n)}</li>`).join("")}</ul>
      <p>Book a call sits under your plan when you have one. It is open to everyone.</p>
    </section>
  </div>
  <div class="about-foot">
    <button type="button" class="glass glass-on" id="about-back">Return to my plan</button>
    <a class="about-link" href="https://themissionautomation.com" target="_blank" rel="noopener">themissionautomation.com, in a new tab</a>
  </div>`}function k(){return[...e.querySelectorAll('button:not([disabled]), a[href], [tabindex="0"]')].filter(t=>t.offsetParent!==null)}function b(){if(e.open)return!0;c=i.activeElement&&i.activeElement!==i.body?i.activeElement:l,e.innerHTML=v(),a(".help-close",e)?.addEventListener("click",()=>s()),a("#about-back",e)?.addEventListener("click",()=>s());try{o.overlay?.open?.("about",{el:e,opener:c,close:s})}catch{}try{typeof e.showModal=="function"?e.showModal():e.setAttribute("open","")}catch{e.setAttribute("open","")}return l?.setAttribute("aria-expanded","true"),d("open"),a("#about-title",e)?.focus({preventScroll:!0}),!0}function s(){if(e.open){try{o.overlay?.close?.("about",{silent:!0})}catch{}try{typeof e.close=="function"?e.close():e.removeAttribute("open")}catch{e.removeAttribute("open")}e.hasAttribute("open")&&e.removeAttribute("open")}}e.addEventListener("close",()=>{l?.setAttribute("aria-expanded","false"),e.innerHTML="";try{o.overlay?.close?.("about",{silent:!0})}catch{}d("close");const t=c&&c.isConnected?c:l;try{t?.focus?.({preventScroll:!0})}catch{}c=null}),e.addEventListener("click",t=>{t.target===e&&s()}),e.addEventListener("keydown",t=>{if(t.stopPropagation(),t.key==="Escape"){t.preventDefault(),s();return}if(t.key!=="Tab")return;const n=k();if(!n.length){t.preventDefault();return}const u=n[0],r=n[n.length-1],h=i.activeElement;t.shiftKey&&(h===u||!e.contains(h)||h===a("#about-title",e))?(t.preventDefault(),r.focus()):!t.shiftKey&&h===r&&(t.preventDefault(),u.focus())}),l?.setAttribute("aria-expanded","false"),l?.addEventListener("click",()=>e.open?s():b()),o.about={open:b,close:s,isOpen:()=>!!e.open}})();
