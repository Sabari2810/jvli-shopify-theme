# Kurti sets and fabric stock

Last updated 2026-11-27.

## What shoppers see

- **Product page:** a kurti with a pant and/or dupatta linked shows a **Set** choice: Kurti only, + Pant, + Dupatta, Full set. The price adds up the pieces. One size covers the whole set; the pant is cut in the kurti's size.
- **Bag:** the pant and dupatta are listed under their kurti and follow its quantity. The pant line carries the size ("Size: M") for cutting.
- **Collections:** **Kurtis** (`/collections/kurtis`) has every product with type *Kurti*. **Kurti sets** (`/collections/kurti-sets`) has every product tagged `set`; its cards show "Set from ₹X" and open with the full set chosen.
- Pants and dupattas never appear on their own in grids or search.

## Adding a new kurti with a set (checklist)

1. **Fabric** (only for a new roll): Shopify admin > Content > Metaobjects > **Fabric** > Add entry. Name, and **Metres left** (e.g. 30).
2. **Pant** product: title like "Pant for Kaavi Kurti", product type **Pant**, tag **`pant`**, price, add to the right GST collection. Under the product's metafields: **Fabric** = the roll, **Fabric per piece (metres)** = e.g. 2. Track quantity on; any starting number (the app sets it).
3. **Dupatta** product (if any): as before, tag **`dupatta`**, its own stock count (dupattas are bought as pieces, not cut from the roll).
4. **Kurti** product: product type **Kurti**, **Made to order: sizes**, and in metafields:
   - **Made to order: pant** = the pant, **Made to order: dupatta** = the dupatta
   - **Fabric** = the roll, **Fabric per piece (metres)** = e.g. 2.5
5. Save. Within seconds the app tags the kurti `set` (so it joins Kurti sets) and sets kurti and pant stock from the fabric. If it hasn't after 15 minutes, check the app is deployed and approved (below).

## Fabric stock (automatic)

The **jvli-favorites** app (repo `Sabari2810/jvli-favorites`, `app/fabric/`, README "Fabric stock and sets") keeps stock right:

- **Order placed:** takes quantity × metres per piece off the fabric, then sets every kurti and pant of that fabric to the whole pieces the metres left allow. Example: 30 m, kurti 2.5 m, pant 2 m → 12 kurtis, 15 pants; a full set order leaves 25.5 m → 10 kurtis, 12 pants.
- **Order cancelled:** gives back exactly what that order took.
- **Every 15 minutes:** recalculates every fabric and the `set` tags.
- **Bought more fabric?** Edit **Metres left** on the Fabric entry. Stock updates within 15 minutes.
- **Don't** edit kurti or pant stock by hand: it is recalculated from metres and your number would be overwritten.

## Test data (delete before launch)

- Fabric entry "TEST fabric - delete me" (10 m)
- "Pant for TEST Made to order kurti - delete me"
- "TEST Made to order kurti - delete me" and its dupatta
