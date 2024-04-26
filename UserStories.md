# User stories for this calculator

## Functional user stories

As a user, I want to:

- [DONE] zoom in and out on a world map based on OpenStreetMap;
  
- [DONE] select an area using a polygonal line and obtain its area in square meters;

- [TODO] observe the usable area for pedestrians in the currently selected polygon, and obtain its area in square meters and its percentage of the total selected area; the usable area for pedestrians is usually a collection of disconnected polygons, herein called "pedestrian spaces";
 
- [TODO] obtain the Physical Carrying Capacity (PCC), Real Carrying Capacity (RCC) and Effective Carrying Capacity (ECC), as defined in [Cifuentes1992](https://www.ucm.es/data/cont/media/www/pag-51898/1992_METODOLOG%C3%8DA%20CIFUENTES.pdf), for the selected polygon, by providing the required  density in terms of persons per square meter (by default 1 person/square meter);

- [TODO] show the border of the pedestrian spaces with the following color scheme, where the intervals relate to the percentage of the selected area that are usable for pedestrians:

    | Percent  | RGB               | Hex     |
    |----------|-------------------|---------|
    | ]00, 10] | (0.482,0.247,0.0) | #7B3F00 |
    | ]10, 20] | (1.00, 0.00, 0.0) | #FF0000 |
    | ]20, 30] | (1.00, 0.25, 0.0) | #FF3F00 |
    | ]30, 40] | (1.00, 0.50, 0.0) | #FF7F00 |
    | ]40, 50] | (1.00, 0.75, 0.0) | #FFBF00 |
    | ]50, 60] | (1.00, 1.00, 0.0) | #FFFF00 |
    | ]60, 70] | (0.750,0.875,0.0) | #BFDF00 |
    | ]70, 80] | (0.50, 0.75, 0.0) | #7FBF00 |
    | ]80, 90] | (0.25, 0.625,0.0) | #3F9F00 |
    | ]90,100] | (0.00, 0.50, 0.0) | #007F00 |

## Non-functional user stories

As a user, I want to:

- [TODO] be aware of the progress of my requests through a progress bar;

- [TODO] obtain incrementally the results of my requests when their processing allows parallelization (e.g. by incremental rendering).

