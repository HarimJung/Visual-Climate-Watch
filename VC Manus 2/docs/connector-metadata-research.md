# CCKP and EM-DAT connector metadata research

## CCKP / World Bank

Official metadata: https://climateknowledgeportal.worldbank.org/metadata
Download terms: https://climateknowledgeportal.worldbank.org/download-data

The CCKP metadata page identifies source versions and CCKP data references. Examples include CRU TS v4.08 with CCKP DOI `https://doi.org/10.57966/tw2k-9h36`, ERA5 0.25-degree with CCKP DOI `https://doi.org/10.57966/128g-6s70`, and projected CMIP6 0.25-degree with CCKP DOI `https://doi.org/10.57966/b54h-7s87`. The World Bank metadata states that observed CRU data covers 1901–present at 0.5-degree resolution and ERA5 covers 1950–present in the CCKP presentation at 0.25-degree resolution. The product UI should distinguish the CCKP-derived dataset reference from the upstream source citation and retain an access date.

## EM-DAT / CRED–UCLouvain

Accessibility: https://doc.emdat.be/docs/data-accessibility/
Terms: https://doc.emdat.be/docs/legal/terms-of-use/
Archive DOI: `https://doi.org/10.14428/DVN/I0LTPH`
Archive license: `CC BY-NC-ND 4.0` (https://creativecommons.org/licenses/by-nc-nd/4.0/)
Public portal: https://public.emdat.be/

The official documentation states that EM-DAT Public Data is the living product updated weekly and requires registration for non-commercial access. The EM-DAT Archive is a validated backup available through the UCLouvain Dataverse and is preferred for reproducible research. Commercial use requires a separate database license; redistribution and creation of substitute or derivative databases are restricted. The product UI must therefore show access mode, license/use restrictions, archive DOI, version/access date, and must not imply unrestricted commercial redistribution.
