/* Lobby descriptions follow the link language; course names remain registry-owned. */
(() => {
  'use strict';
  if (new URL(location.href).searchParams.get('lang') !== 'nl') return;
  document.documentElement.lang = 'nl';
  function description(selector, before, after = '') {
    const target = document.querySelector(selector);
    if (!target) return;
    const course = target.querySelector('[data-slot="course.short_name"]');
    target.replaceChildren(document.createTextNode(before));
    if (course) target.append(course);
    if (after) target.append(document.createTextNode(after));
    target.lang = 'nl';
  }
  description('.hero-desc',
    'Gebruik GenAI op een manier die aansluit bij je vak en academisch verantwoord is — ter ondersteuning van je denk- en schrijfproces binnen ', '.');
  description('.card:not(.card-accent):not(.card-dark) .card-desc',
    'Een brede introductie tot verantwoord gebruik van GenAI in een academische context. Leg een algemene basis voordat je begint met de vakspecifieke oriëntatie voor ', '.');
  description('.card-accent .card-desc',
    'Ontdek welke rol GenAI speelt binnen ', ', waarvoor het nuttig is en hoe je het verantwoord kunt gebruiken binnen deze module.');
  description('.card-dark .card-desc',
    'Gebruik de diagnostische vragenlijst om te bepalen welke stap het beste past bij waar je nu bent in je schrijfproces, en ga direct aan de slag.');
})();
