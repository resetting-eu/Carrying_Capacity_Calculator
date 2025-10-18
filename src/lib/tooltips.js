module.exports = {
  "walkable-area": "The area of the geometry that a pedestrian can walk on. "
    + "This area is drawn on the map and is shown in this table both in absolute terms "
    + "and as a percentage of the total area.",
  "area-per-pedestrian": "Minimum area required for each pedestrian. The suggested values represent the lower levels of each Level of Service for walking pedestrians (from the Highway Capacity Manual)",
  "rotation-factor": "Number of visits within a time period (usually a day). "
    + "Set this to 1 to get instant PCC.",
  "physical-carrying-capacity": "Physical Carrying Capacity: "
    + "maximum number of visitors that can be physically "
    + "accomodated into the walkable area over some time. "
    + "The value is obtained by dividing 'Walkable Area' by 'Area per Pestrian' "
    + "and multiplying the result by 'Rotation Factor'.",
  "real-carrying-capacity": "Real Carrying Capacity: "
    + "derived from PCC, applying corrective factors with different natures "
    + "(e.g., physical, ecological, economical), specific to the location. "
    + "These corrective factors should be numbers between 0 and 1. "
    + "The value of RCC is obtained by multiplying 'PCC' by the corrective factors.",
  "management-capacity": "This variable is often determined by the adequacy "
    + "of the available infrastructure, equipment, and staff for the tourism activity.",
  "effective-carrying-capacity": "Effective Carrying Capacity: "
    + "the final stage of TCC (Tourism Carrying Capacity). "
    + "Its value is determined by multiplying 'Management Capacity' by 'RCC'."
};
