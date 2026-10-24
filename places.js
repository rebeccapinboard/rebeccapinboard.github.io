// Demo content. Replace coordinates and photos with Rebecca's actual stops.
// You can add more than one photo to a place's `photos` array; the album will
// appear in the selected country's gallery. Give each photo its own location,
// coordinates, and description of Rebecca's photography techniques.
window.PLACES = [
  {
    id: "italy",
    name: "Italy",
    region: "Europe",
    coordinates: [42.83, 12.83],
    zoom: 6,
    description: "A space for sun-soaked streets, little discoveries, and Rebecca's favorite moments from Italy.",
    photos: [{ src: "images/italy.webp", alt: "Illustrative sample photo of an Italian coastal village", location: "Italy (sample location)", description: "Illustrative preview. Rebecca's own photo notes and techniques will go here." }]
  },
  {
    id: "switzerland",
    name: "Switzerland",
    region: "Europe",
    coordinates: [46.82, 8.23],
    zoom: 7,
    description: "Mountain views and memorable days belong here, alongside the photos and stories Rebecca wants to share.",
    photos: [{ src: "images/switzerland.webp", alt: "Illustrative sample photo of a Swiss alpine lake", location: "Switzerland (sample location)", description: "Illustrative preview. Rebecca's own photo notes and techniques will go here." }]
  },
  {
    id: "australia",
    name: "Australia",
    region: "Oceania",
    coordinates: [-25.27, 133.77],
    zoom: 4,
    description: "From familiar corners to new adventures, this pin is waiting for Rebecca's own Australian photo album.",
    photos: [{ src: "images/australia.webp", alt: "Illustrative sample photo of the Australian coast", location: "Australia (sample location)", description: "Illustrative preview. Rebecca's own photo notes and techniques will go here." }]
  },
  {
    id: "china",
    name: "China",
    region: "Asia",
    coordinates: [35.86, 104.19],
    zoom: 5,
    description: "A place to collect the colors, places, and little moments she remembers from her time in China.",
    photos: [{ src: "images/china.webp", alt: "Illustrative sample photo of a traditional Chinese garden", location: "China (sample location)", description: "Illustrative preview. Rebecca's own photo notes and techniques will go here." }]
  },
  {
    id: "japan",
    name: "Japan",
    region: "Asia",
    coordinates: [36.20, 138.25],
    zoom: 6,
    description: "A new place in Rebecca's photography collection, ready for her own images and stories.",
    photos: [{ src: "images/japan.webp", alt: "Illustrative sample photo of a Kyoto street in Japan", location: "Kyoto, Japan (sample scene)", coordinates: [35.0116, 135.7681], description: "Illustrative preview. Rebecca's own photo notes and techniques will go here." }]
  }
];
