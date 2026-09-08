"""DEV-ONLY: seed reading groups + generate graded Norwegian stories on the fly.

Generates story bodies via OpenRouter (LESSON_MODEL), then inserts Story rows and
paginates/annotates them synchronously by calling the real reading job, so no
worker or HTTPS hosting is needed for local content.

Usage:  cd backend && uv run python scripts/dev_seed_reading.py [--count N]
Reads OPENROUTER_API_KEY / LESSON_MODEL from env (falls back to hand-authored
stories if the key is missing or a call fails).
"""

import argparse
import asyncio
import os
import sys

import httpx
from sqlalchemy import select

from flyt.apps.reading.models import ReadingGroup
from flyt.apps.reading.models import Story
from flyt.apps.reading.models import StoryVisibility
from flyt.apps.reading.tasks import generate_story_pages
from flyt.core.db import AsyncSessionLocal

GROUPS = [
    ("hverdag", "Hverdagsliv", 0),
    ("eventyr", "Eventyr og fortellinger", 1),
    ("kultur", "Kultur og samfunn", 2),
]

# (group_key, cefr, slug, title, prompt-hint, fallback-body)
SPECS = [
    (
        "hverdag",
        "A1",
        "en-vanlig-morgen",
        "En vanlig morgen",
        "a simple A1 story about waking up and morning routine",
        "Jeg våkner klokka sju. Jeg står opp og går på badet.\n\n"
        "Jeg spiser frokost. Jeg drikker kaffe og spiser brød.\n\n"
        "Så tar jeg bussen til jobben. Bussen er full av folk.",
    ),
    (
        "hverdag",
        "A2",
        "pa-butikken",
        "På butikken",
        "an A2 story about shopping for groceries and talking to a cashier",
        "I dag skal jeg handle mat. Jeg trenger melk, brød og grønnsaker.\n\n"
        "På butikken møter jeg naboen min. Vi snakker litt om været.\n\n"
        "Jeg betaler med kort. Kassereren sier ha det bra, og jeg går hjem.",
    ),
    (
        "eventyr",
        "A2",
        "den-lille-baten",
        "Den lille båten",
        "an A2 folk-tale style story about a small boat on a fjord",
        "Det var en gang en liten båt. Den lå ved en stille fjord.\n\n"
        "En dag kom en gutt og satte seg i båten. Han rodde langt ut.\n\n"
        "Sola gikk ned, og gutten rodde hjem igjen. Han var trøtt, men glad.",
    ),
    (
        "kultur",
        "B1",
        "syttende-mai",
        "Syttende mai",
        "a B1 story about Norway's national day, 17 May celebrations",
        "Syttende mai er Norges nasjonaldag. Folk feirer hele dagen.\n\n"
        "Barna går i tog med flagg. Mange har på seg bunad, en tradisjonell drakt.\n\n"
        "Det er korps, is og pølser. Det er en av de viktigste dagene i året.",
    ),
    (
        "kultur",
        "B1",
        "norsk-natur",
        "Norsk natur",
        "a B1 story about Norwegian nature, mountains and hiking culture",
        "Naturen betyr mye for nordmenn. Mange går tur i helgene.\n\n"
        "Om sommeren går folk i fjellet. Om vinteren går de på ski.\n\n"
        "Mange har en hytte. Der kan de slappe av og være i fred.",
    ),
    (
        "eventyr",
        "B2",
        "reisen-til-nord",
        "Reisen til nord",
        "a long B2 literary story (~2000 words) about a journey to northern Norway",
        """Det begynte med en impuls – et plutselig, uforklarlig ønske om å dra nordover. Maren hadde sittet ved skrivebordet sitt i Oslo i tre år og skrevet andres historier. Som journalist hadde hun dekket politikk, kultur og katastrofer, men noe manglet. Ordene kom lettere enn noen gang, men de føltes hule. En kveld i november pakket hun en bag, kjøpte billett til Tromsø og fortalte ingen hvor hun skulle.

Flyet landet sent om natten. Utenfor terminalen møtte kuldegrader og stille. Gatene var tomme bortsett fra en gammel mann som dro en kjelke med ved. Maren tok inn på et lite pensjonat ikke langt fra havnen. Rommet var enkelt – en seng, en stol og et vindu som vendte mot sjøen. Perfekt, tenkte hun.

De første dagene gikk hun bare. Hun vandret langs kaia, opp bakker og ned igjen, gjennom smale gater med trebygninger i rødt og gult. Tromsø var en by av kontraster: moderne hoteller ved siden av fiskebrygger fra forrige århundre, studenter ved siden av fiskere, støy fra barer ved siden av dypt fjordstille.

På den fjerde dagen gikk hun inn på en kafé for å varme seg. Bak disken sto en kvinne i femtiårene med grått hår og et smil som virket som det hadde vært der lenge. Hun het Ragnhild og hadde drevet kaféen i tjue år.

«Du ser ut som en som leter etter noe,» sa Ragnhild og satte en kopp kaffe foran henne uten at Maren hadde bestilt.

«Er det så tydelig?» sa Maren.

«Bare for dem som har gjort det samme.»

De begynte å snakke, og kaffen ble kald. Ragnhild hadde selv kommet nordover som ung – fra Bergen, av alle steder – etter et samlivsbrudd som hadde etterlatt henne tom. Hun hadde tenkt å bli en måned. Det ble resten av livet.

«Hva er det du leter etter?» spurte Ragnhild.

Maren tenkte. «En historie som er min egen.»

Ragnhild nikket langsomt. «Da må du snakke med Isak.»

Isak Hætta var samisk, syttifire år gammel og bodde alene i et gammelt hus utenfor byen. Han hadde tidligere vært reindriftssame, men hadde etter hvert overlatt flokken til sønnen. Nå levde han stille, malte bilder og tok imot besøk fra folk som Ragnhild sendte til ham – folk som trengte å høre noe de ikke visste de trengte.

Maren fant huset etter en times kjøring langs en vei som smalnet til ingenting. Huset lå ved foten av et fjell, omgitt av bjørketrær som hadde mistet bladene sine. En tynn røyksøyle steg opp fra pipa. Hun banket på. Det tok tid, men døren åpnet seg.

Isak så på henne lenge uten å si noe. Så trakk han seg til siden og lot henne inn.

Innenfor luktet det tre og kaffe og noe annet – en gammel, rolig lukt som Maren ikke klarte å sette navn på. Veggene var dekket av malerier: fjell i blått og lilla, reinsdyr i storm, en kvinne som sto alene ved sjøen og så utover.

«Sett deg,» sa han.

De drakk te. Isak snakket lite til å begynne med, men det han sa satt. Han fortalte om livet med reinen – den konstante bevegelsen, ansvaret for dyrene, sykdomsårene da kalver døde og snøen lå for tungt. Han fortalte om hvordan han hadde lært å lese fjellet, om vindretninger og skymønstre og lyder som varslet vær.

«Naturen snakker,» sa han. «Men du må slutte å snakke selv for å høre det.»

Maren ble i tre timer. Da hun forlot huset, var det mørkt og nordlyset beveget seg i grønt og rosa over fjellet bak huset. Hun stanset og sto stille. For første gang på lang tid tenkte hun ikke på noe.

Dagene som fulgte ble en rytme. Morgen på kaféen med Ragnhild, ettermiddag ute i mørket og kulden, kvelder med notatblokka. Men nå var notatene annerledes. Hun skrev ikke fakta. Hun skrev observasjoner, spørsmål, minner. Hun skrev om stemmer og stillhet.

En dag tok hun bussen ut til en liten bygd sørøst for Tromsø. Der møtte hun Astrid, en lærer i sekstiårene som hadde bodd der hele livet. Astrid viste henne rundt i bygda og snakket om hvordan stedet hadde forandret seg: fiskeriene som sakte forsvant, ungdommene som dro til byene, husene som sto tomme.

«Men noen kommer tilbake,» sa Astrid. «Og noen nye kommer. Som deg.»

«Jeg er bare på besøk,» sa Maren.

«Det sier alle.»

En uke ble to. Maren ringte redaktøren sin og sa hun trengte mer tid. Det var en samtale hun hadde fryktet, men han overrasket henne. «Ta den tida du trenger,» sa han. «Kom tilbake med noe ekte.»

Ekte. Ordet ble sittende.

Sent en kveld satt hun i pensjonatsrommet og leste igjennom alt hun hadde skrevet. Det var mer enn hun trodde – over femti sider med notater. Ragnhild og kafeen. Isak og maleriene hans. Astrid og den tomme bygda. Nordlyset. Kulden som brant i lungene om morgenene. En samtale hun hadde hørt mellom to menn ved kaia om en fortapt båt. En eldre dame hun hadde sett stå alene utenfor en kirke og se opp mot himmelen.

Det var ikke én historie. Det var mange.

Men dypt inne i dem alle var det noe felles – noe om det å bo i ytterkanten av et land, om å leve med naturen som nabo, om å finne mening i stille dager og mørke vintre. Om at å dra nordover ikke var å flykte, men å nærme seg noe.

Maren åpnet laptopen og begynte å skrive. Ikke et reportasje. Ikke en artikkel. Noe annet – noe hun ikke hadde et navn på ennå, men som kjentes riktig på en måte hun hadde glemt at ting kunne kjennes.

Utenfor vinduet lå fjorden stille og svart, og stjernene over fjellet brant klart i den iskalde luften.

Hun skrev til langt på natt, og for første gang på tre år stoppet hun ikke for å sjekke om det var bra nok. Hun bare skrev.

Det var nok.""",
    ),
]


async def _generate_body(
    client: httpx.AsyncClient, model: str, key: str, hint: str
) -> str | None:
    prompt = (
        f"Write {hint}, in Norwegian Bokmål only. "
        "3 to 4 short paragraphs separated by blank lines. "
        "Use simple, natural language for the level. Output only the story text, no title."
    )
    try:
        resp = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={"Authorization": f"Bearer {key}"},
            json={"model": model, "messages": [{"role": "user", "content": prompt}]},
            timeout=60,
        )
        resp.raise_for_status()
        text = resp.json()["choices"][0]["message"]["content"].strip()
        return text or None
    except Exception as exc:
        print(f"  LLM failed ({exc}); using fallback body", file=sys.stderr)
        return None


async def main(count: int) -> None:
    key = os.environ.get("OPENROUTER_API_KEY")
    model = os.environ.get("LESSON_MODEL", "google/gemini-2.5-flash")
    async with AsyncSessionLocal() as db:
        # Groups
        groups: dict[str, ReadingGroup] = {}
        for gkey, title, order in GROUPS:
            grp = await db.scalar(select(ReadingGroup).where(ReadingGroup.key == gkey))
            if grp is None:
                grp = ReadingGroup(key=gkey, title=title, order=order)
                db.add(grp)
                await db.flush()
            groups[gkey] = grp
        await db.commit()

        client = httpx.AsyncClient() if key else None
        created_ids: list[int] = []
        for gkey, cefr, slug, title, hint, fallback in SPECS[:count]:
            if await db.scalar(select(Story.id).where(Story.slug == slug)):
                print(f"  skip {slug} (exists)")
                continue
            body = None
            if client is not None and key is not None:
                body = await _generate_body(client, model, key, hint)
            body = body or fallback
            story = Story(
                slug=slug,
                title=title,
                cefr_level=cefr,
                reading_group_id=groups[gkey].id,
                visibility=StoryVisibility.PUBLIC,
                is_ready=True,
                content=body,
                word_count=len(body.split()),
            )
            db.add(story)
            await db.flush()
            created_ids.append(story.id)
            print(f"  created {slug} (id={story.id}, {len(body.split())} words)")
        await db.commit()
        if client:
            await client.aclose()

        for sid in created_ids:
            await generate_story_pages({}, sid)
        print(f"Done. {len(created_ids)} stories created + paginated.")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--count", type=int, default=len(SPECS))
    args = ap.parse_args()
    asyncio.run(main(args.count))
