-- Add DELETE and UPDATE policies on miembros_organizacion
-- so SuperAdmins and Organizadores can manage staff members

-- Allow SuperAdmins and Organizadores to delete members from their orgs
CREATE POLICY "SuperAdmin y Organizadores eliminan miembros de su org"
ON public.miembros_organizacion FOR DELETE
USING (
  public.es_superadmin() OR
  public.es_usuario_superadmin(auth.uid()) OR
  public.es_organizador_de_org(auth.uid(), organizacion_id)
);

-- Allow SuperAdmins and Organizadores to insert members into their orgs
CREATE POLICY "SuperAdmin y Organizadores insertan miembros en su org"
ON public.miembros_organizacion FOR INSERT
WITH CHECK (
  public.es_superadmin() OR
  public.es_usuario_superadmin(auth.uid()) OR
  public.es_organizador_de_org(auth.uid(), organizacion_id)
);

-- Allow SuperAdmins to update any user profile role
DROP POLICY IF EXISTS "Usuarios actualizan su propio perfil" ON public.perfiles_usuarios;

CREATE POLICY "Usuarios actualizan su propio perfil o SuperAdmin actualiza"
ON public.perfiles_usuarios FOR UPDATE
USING (
  auth.uid() = id OR
  public.es_superadmin() OR
  public.es_usuario_superadmin(auth.uid())
);
