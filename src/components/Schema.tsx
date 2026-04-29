'use client';

import React from 'react';

export default function Schema() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Hotel',
    'name': 'Hotel Du Manolo',
    'alternateName': 'Hotel Dumanolo',
    'description': 'Hotel Du Manolo - Privacidad, Lujo y Discreción en Heredia, Costa Rica. El mejor motel de lujo con habitaciones premium y servicio exclusivo.',
    'image': 'https://hotel-du-manolo-cr.com/hero_bg_clean.png',
    'url': 'https://hotel-du-manolo-cr.com',
    'sameAs': [
      'https://www.google.com/maps/place/Hotel+Dumanolo/@9.9940102,-84.1182926,17z'
    ],
    'telephone': '+506 2261-3508',
    'address': {
      '@type': 'PostalAddress',
      'streetAddress': 'Heredia, Costa Rica',
      'addressLocality': 'Heredia',
      'addressRegion': 'Heredia',
      'postalCode': '40101',
      'addressCountry': 'CR'
    },
    'geo': {
      '@type': 'GeoCoordinates',
      'latitude': 9.9940102,
      'longitude': -84.1182926
    },
    'amenityFeature': [
      {
        '@type': 'LocationFeatureSpecification',
        'name': 'Jacuzzi',
        'value': true
      },
      {
        '@type': 'LocationFeatureSpecification',
        'name': 'Wi-Fi Gratuito',
        'value': true
      },
      {
        '@type': 'LocationFeatureSpecification',
        'name': 'Privacidad Total',
        'value': true
      }
    ],
    'starRating': {
      '@type': 'Rating',
      'ratingValue': '5'
    }
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
