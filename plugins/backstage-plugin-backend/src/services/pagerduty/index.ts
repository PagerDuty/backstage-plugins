import { getServicesByPartialName } from "../../apis/pagerduty";

export async function getServicesIdsByPartialName(partialName: string): Promise<string[]> {
  const pagerdutyServices = await getServicesByPartialName(partialName);

  return pagerdutyServices.map(service => service.id);
}
