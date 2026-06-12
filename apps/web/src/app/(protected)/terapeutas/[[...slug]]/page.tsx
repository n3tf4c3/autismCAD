import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ slug?: string[] }>;
};

export default async function LegacyTerapeutasRedirectPage(props: PageProps) {
  const { slug = [] } = await props.params;
  const suffix = slug.length ? `/${slug.join("/")}` : "";
  redirect(`/profissionais${suffix}`);
}
