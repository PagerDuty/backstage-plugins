import { getAllServices } from "../../apis/pagerduty";

export async function getServicesIdsByPartialName(partialName: string): Promise<string[]> {
  const pagerdutyServices = await getAllServices();
  const matchingServices = pagerdutyServices.filter(service =>
    service.name
      .toLowerCase()
      .includes(partialName.toLowerCase()),
  );

  return matchingServices.map(service => service.id);
}
