import Adapt from 'core/js/adapt';

/**
 * Opslag voor vrije invulvelden in de cursus.
 *
 * De invulvelden zijn gewone textarea's in een text-component, geen
 * vraagcomponent. Dat is bewust: een vraagcomponent zou de tekst als goed of
 * fout beoordelen, het veld na verzenden op slot zetten, en vrije tekst kan het
 * sowieso niet onthouden (het bewaart alleen een antwoord-index).
 *
 * Hier bewaren we de tekst per veld in localStorage, zodat de student altijd
 * kan blijven bijschaven en zijn werk terugvindt.
 */

const SLEUTEL = 'scrum-canvas-v1';

function lees() {
  try {
    return JSON.parse(window.localStorage.getItem(SLEUTEL)) || {};
  } catch (e) {
    return {};
  }
}

function schrijf(data) {
  try {
    window.localStorage.setItem(SLEUTEL, JSON.stringify(data));
    return true;
  } catch (e) {
    // Privémodus of volle opslag: dan werkt het canvas nog, maar bewaart niet.
    return false;
  }
}

class CanvasOpslag extends Backbone.Controller {

  initialize() {
    $(document)
      .on('input', '.js-canvas-veld', this.bewaar.bind(this))
      .on('click', '.js-canvas-kopieren', this.kopieer.bind(this))
      .on('click', '.js-canvas-wissen', this.wis.bind(this));

    // De velden staan in de body-HTML van een text-component. Wanneer die precies
    // in de DOM belandt hangt af van de rendervolgorde, en de render-events van
    // Adapt vuren daar te vroeg voor. Een observer is hier simpelweg betrouwbaarder
    // dan gokken op het juiste moment.
    this.observer = new MutationObserver(() => this.herstel());
    this.listenTo(Adapt, 'app:dataReady', this.startObserver);
    if (document.readyState !== 'loading') this.startObserver();
  }

  startObserver() {
    if (this._loopt) return;
    const doel = document.getElementById('wrapper') || document.body;
    if (!doel) return;
    this._loopt = true;
    this.observer.observe(doel, { childList: true, subtree: true });
    this.herstel();
  }

  /**
   * Vult bewaarde tekst in velden die nog niet hersteld zijn.
   * De vlag voorkomt dat we typewerk overschrijven als de observer opnieuw afgaat.
   */
  herstel() {
    const velden = document.querySelectorAll('.js-canvas-veld:not([data-hersteld])');
    if (!velden.length) return;
    const data = lees();
    velden.forEach(el => {
      el.setAttribute('data-hersteld', '1');
      if (data[el.id]) el.value = data[el.id];
    });
  }

  bewaar(event) {
    const el = event.currentTarget;
    const data = lees();
    if (el.value.trim()) {
      data[el.id] = el.value;
    } else {
      delete data[el.id];
    }
    schrijf(data);
  }

  /**
   * Bouwt het canvas op als platte tekst, in de volgorde waarin het op de pagina staat.
   * De laagnaam komt uit data-laag en niet uit de zichtbare kop: die bevat ook
   * verborgen tekst voor schermlezers ("Nog niet afgerond") die je niet wilt meekopiëren.
   */
  alsTekst() {
    const regels = ['MIJN SCRUM-WERKPLAN', ''];
    $('.canvas-groep').each((i, groep) => {
      const laag = $(groep).data('laag');
      if (laag) regels.push(String(laag).toUpperCase());
      $(groep).find('.canvas-rij').each((j, rij) => {
        const label = $(rij).find('.canvas-label').text().trim();
        const waarde = $(rij).find('.js-canvas-veld').val().trim();
        regels.push('  ' + label + ': ' + (waarde || '—'));
      });
      regels.push('');
    });
    return regels.join('\n');
  }

  kopieer() {
    const tekst = this.alsTekst();
    const klaar = () => this.meld('Gekopieerd naar je klembord.');
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(tekst).then(klaar, () => this.kopieerTerugval(tekst, klaar));
      return;
    }
    this.kopieerTerugval(tekst, klaar);
  }

  /** Voor browsers of pagina's zonder clipboard-API, bijvoorbeeld in een LMS-frame. */
  kopieerTerugval(tekst, klaar) {
    const hulp = document.createElement('textarea');
    hulp.value = tekst;
    hulp.setAttribute('readonly', '');
    hulp.style.cssText = 'position:absolute;left:-9999px;top:0';
    document.body.appendChild(hulp);
    hulp.select();
    try {
      document.execCommand('copy');
      klaar();
    } catch (e) {
      this.meld('Kopiëren lukt niet in deze browser. Selecteer de tekst handmatig.');
    }
    document.body.removeChild(hulp);
  }

  wis() {
    if (!window.confirm('Weet je zeker dat je je hele canvas wist? Dit kun je niet ongedaan maken.')) return;
    $('.js-canvas-veld').each((i, el) => { el.value = ''; });
    schrijf({});
    this.meld('Je canvas is gewist.');
  }

  meld(tekst) {
    const $melding = $('.js-canvas-melding');
    $melding.text(tekst);
    clearTimeout(this._meldingTimer);
    this._meldingTimer = setTimeout(() => $melding.text(''), 4000);
  }

}

export default new CanvasOpslag();
