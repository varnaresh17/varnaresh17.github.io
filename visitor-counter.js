/* Retired public counter. Clean up old page copies without requesting statistics. */
(function(){
  'use strict';
  if(typeof document==='undefined')return;
  for(const element of document.querySelectorAll('.site-visit-counter'))element.remove();
})();
