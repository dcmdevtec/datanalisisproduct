declare module 'react-leaflet-draw' {
  import { Component } from 'react';
  import L from 'leaflet';
  
  interface EditControlProps {
    position?: 'topleft' | 'topright' | 'bottomleft' | 'bottomright';
    onCreated?: (e: any) => void;
    onEdited?: (e: any) => void;
    onDeleted?: (e: any) => void;
    draw?: {
      polyline?: boolean | any;
      polygon?: boolean | any;
      rectangle?: boolean | any;
      circle?: boolean | any;
      marker?: boolean | any;
      circlemarker?: boolean | any;
    };
    edit?: {
      featureGroup: L.FeatureGroup;
      remove?: boolean;
      edit?: boolean;
    };
  }
  
  export class EditControl extends Component<EditControlProps> {}
}