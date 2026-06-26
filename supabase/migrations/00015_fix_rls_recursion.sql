-- 1. Crear funciones SECURITY DEFINER auxiliares para evitar recursión en RLS
CREATE OR REPLACE FUNCTION public.es_usuario_superadmin(p_usuario_id UUID)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.perfiles_usuarios
    WHERE id = p_usuario_id
    AND rol = 'SuperAdmin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.es_organizador_de_org(p_usuario_id UUID, p_organizacion_id INT)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.miembros_organizacion mo
    JOIN public.perfiles_usuarios pu ON pu.id = mo.usuario_id
    WHERE mo.usuario_id = p_usuario_id
    AND mo.organizacion_id = p_organizacion_id
    AND pu.rol = 'Organizador'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Corregir política recursiva en miembros_organizacion
DROP POLICY IF EXISTS "Organizadores leen miembros de su org" ON public.miembros_organizacion;

CREATE POLICY "Organizadores leen miembros de su org"
ON public.miembros_organizacion FOR SELECT
USING (
  usuario_id = auth.uid() OR
  public.es_superadmin() OR
  public.es_usuario_superadmin(auth.uid()) OR
  public.es_organizador_de_org(auth.uid(), organizacion_id)
);


-- 3. Recrear políticas de torneos usando las funciones no recursivas
DROP POLICY IF EXISTS "Organizadores insertan torneos de su org" ON public.torneos;
DROP POLICY IF EXISTS "Organizadores actualizan torneos de su org" ON public.torneos;
DROP POLICY IF EXISTS "Organizadores eliminan torneos de su org" ON public.torneos;

CREATE POLICY "Organizadores insertan torneos de su org"
ON public.torneos FOR INSERT
WITH CHECK (
  public.es_superadmin() OR
  public.es_usuario_superadmin(auth.uid()) OR
  public.es_organizador_de_org(auth.uid(), organizacion_id)
);

CREATE POLICY "Organizadores actualizan torneos de su org"
ON public.torneos FOR UPDATE
USING (
  public.es_superadmin() OR
  public.es_usuario_superadmin(auth.uid()) OR
  public.es_organizador_de_org(auth.uid(), torneos.organizacion_id)
);

CREATE POLICY "Organizadores eliminan torneos de su org"
ON public.torneos FOR DELETE
USING (
  public.es_superadmin() OR
  public.es_usuario_superadmin(auth.uid()) OR
  public.es_organizador_de_org(auth.uid(), torneos.organizacion_id)
);


-- 4. Recrear políticas de tarifas_torneo
DROP POLICY IF EXISTS "Organizadores insertan tarifas de su org" ON public.tarifas_torneo;
DROP POLICY IF EXISTS "Organizadores actualizan tarifas de su org" ON public.tarifas_torneo;
DROP POLICY IF EXISTS "Organizadores eliminan tarifas de su org" ON public.tarifas_torneo;

CREATE POLICY "Organizadores insertan tarifas de su org"
ON public.tarifas_torneo FOR INSERT
WITH CHECK (
  public.es_superadmin() OR
  public.es_usuario_superadmin(auth.uid()) OR
  EXISTS (
    SELECT 1 FROM public.torneos t
    WHERE t.id = torneo_id
    AND public.es_organizador_de_org(auth.uid(), t.organizacion_id)
  )
);

CREATE POLICY "Organizadores actualizan tarifas de su org"
ON public.tarifas_torneo FOR UPDATE
USING (
  public.es_superadmin() OR
  public.es_usuario_superadmin(auth.uid()) OR
  EXISTS (
    SELECT 1 FROM public.torneos t
    WHERE t.id = tarifas_torneo.torneo_id
    AND public.es_organizador_de_org(auth.uid(), t.organizacion_id)
  )
);

CREATE POLICY "Organizadores eliminan tarifas de su org"
ON public.tarifas_torneo FOR DELETE
USING (
  public.es_superadmin() OR
  public.es_usuario_superadmin(auth.uid()) OR
  EXISTS (
    SELECT 1 FROM public.torneos t
    WHERE t.id = tarifas_torneo.torneo_id
    AND public.es_organizador_de_org(auth.uid(), t.organizacion_id)
  )
);


-- 5. Recrear políticas de partidos
DROP POLICY IF EXISTS "Organizadores insertan partidos de su org" ON public.partidos;
DROP POLICY IF EXISTS "Organizadores actualizan partidos de su org" ON public.partidos;
DROP POLICY IF EXISTS "Organizadores eliminan partidos de su org" ON public.partidos;

CREATE POLICY "Organizadores insertan partidos de su org"
ON public.partidos FOR INSERT
WITH CHECK (
  public.es_superadmin() OR
  public.es_usuario_superadmin(auth.uid()) OR
  EXISTS (
    SELECT 1 FROM public.torneos t
    WHERE t.id = torneo_id
    AND public.es_organizador_de_org(auth.uid(), t.organizacion_id)
  )
);

CREATE POLICY "Organizadores actualizan partidos de su org"
ON public.partidos FOR UPDATE
USING (
  public.es_superadmin() OR
  public.es_usuario_superadmin(auth.uid()) OR
  EXISTS (
    SELECT 1 FROM public.torneos t
    WHERE t.id = partidos.torneo_id
    AND public.es_organizador_de_org(auth.uid(), t.organizacion_id)
  )
);

CREATE POLICY "Organizadores eliminan partidos de su org"
ON public.partidos FOR DELETE
USING (
  public.es_superadmin() OR
  public.es_usuario_superadmin(auth.uid()) OR
  EXISTS (
    SELECT 1 FROM public.torneos t
    WHERE t.id = partidos.torneo_id
    AND public.es_organizador_de_org(auth.uid(), t.organizacion_id)
  )
);


-- 6. Recrear políticas de canchas para evitar recursiones similares
DROP POLICY IF EXISTS "Lectura de canchas" ON public.canchas;
DROP POLICY IF EXISTS "Organizadores insertan canchas de su org" ON public.canchas;
DROP POLICY IF EXISTS "Organizadores actualizan canchas de su org" ON public.canchas;
DROP POLICY IF EXISTS "Organizadores eliminan canchas de su org" ON public.canchas;

CREATE POLICY "Lectura de canchas"
ON public.canchas FOR SELECT
USING (
  activa = true OR
  public.es_superadmin() OR
  public.es_usuario_superadmin(auth.uid()) OR
  public.es_organizador_de_org(auth.uid(), organizacion_id)
);

CREATE POLICY "Organizadores insertan canchas de su org"
ON public.canchas FOR INSERT
WITH CHECK (
  public.es_superadmin() OR
  public.es_usuario_superadmin(auth.uid()) OR
  public.es_organizador_de_org(auth.uid(), organizacion_id)
);

CREATE POLICY "Organizadores actualizan canchas de su org"
ON public.canchas FOR UPDATE
USING (
  public.es_superadmin() OR
  public.es_usuario_superadmin(auth.uid()) OR
  public.es_organizador_de_org(auth.uid(), canchas.organizacion_id)
);

CREATE POLICY "Organizadores eliminan canchas de su org"
ON public.canchas FOR DELETE
USING (
  public.es_superadmin() OR
  public.es_usuario_superadmin(auth.uid()) OR
  public.es_organizador_de_org(auth.uid(), canchas.organizacion_id)
);
