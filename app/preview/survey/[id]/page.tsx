"use client"

import SurveyPreviewPage from "../page"

export default function SurveyPreviewWithId({ params }: { params: { id: string } }) {
  // The preview client component infers the surveyId from the pathname (window.location).
  // This wrapper exists so Next's app-router recognizes /preview/survey/[id] and doesn't 404.
  return <SurveyPreviewPage />
}